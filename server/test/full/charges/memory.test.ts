import { createHash } from 'node:crypto';
import { asInstitutionId } from '@genki/shared';
import type { SERVICIO_FACTURABLE } from '@genki/shared/full/charges';
import {
  MemoryChargesStore,
  hashChargesSnapshot,
} from '../../../src/adapters/memory/full/charges.js';
import {
  registerExtensionNamespace,
  resetExtensionRegistryForTests,
} from '../../../src/adapters/memory/full-state.js';
import { createTestMemoryAdapterSet } from '../../../src/config/memory-test-factory.js';
import { MemoryIdPort } from '../../../src/adapters/memory/id.js';
import { baseRegisterInput, defaultKind, OTHER_INSTITUTION_ID } from '../../contracts/fixtures.js';
import { moduleContract, type FullHarness } from '../charges.contract.js';
import type { FullContext, OperationContext } from '../../../src/ports/full/context.js';
import { createChargesPort } from '../../../src/application/full/charges.js';

function seedCatalogs(
  state: ReturnType<typeof createTestMemoryAdapterSet>['memoryState'],
  institutionId: number,
): void {
  const catalogs = state.getPublished().catalogs;
  catalogs.municipios.clear();
  catalogs.profesionales.clear();
  catalogs.medicamentos.clear();
  catalogs.cie10.clear();
  catalogs.municipios.set(1, { id_municipio: 1, nombre: 'Municipio de prueba' });
  catalogs.profesionales.set(institutionId === OTHER_INSTITUTION_ID ? 99 : 1, {
    id_profesional: institutionId === OTHER_INSTITUTION_ID ? 99 : 1,
    nombres: 'Profesional',
    apellidos: 'Prueba',
    activo: true,
  });
}

function clearClinical(state: ReturnType<typeof createTestMemoryAdapterSet>['memoryState']): void {
  const maps = state.getPublished();
  maps.pacientes.clear();
  maps.expedientes.clear();
  maps.responsables.clear();
  maps.consultas.clear();
  maps.diagnosticos.clear();
  maps.tratamientos.clear();
  maps.recetas.clear();
  maps.detalles.clear();
  maps.counters.clear();
  maps.extensions.clear();
}

async function buildHarness(institutionId: number, sequences: MemoryIdPort): Promise<FullHarness> {
  resetExtensionRegistryForTests();
  registerExtensionNamespace('charges');
  const adapters = createTestMemoryAdapterSet(defaultKind(), institutionId, { ids: sequences });
  seedCatalogs(adapters.memoryState, institutionId);

  const store = new MemoryChargesStore(adapters.memoryState);

  const contextHolder: { current: FullContext | null } = { current: null };
  const charges = createChargesPort(() => {
    if (!contextHolder.current) {
      throw new Error('FullContext not ready');
    }
    return contextHolder.current;
  }, store);

  const actor: OperationContext = {
    id_institucion: asInstitutionId(institutionId),
    id_usuario: 1,
    id_profesional: null,
    roles: ['caja'],
    permissions: [],
    now: '2026-11-08T12:00:00.000Z',
  };

  const stub = new Proxy(
    {},
    {
      get: () => async () => {
        throw new Error('module stub');
      },
    },
  );

  const context: FullContext = {
    base: {
      pacientes: adapters.pacientes,
      consultas: adapters.consultas,
      catalogos: adapters.catalogos,
      unitOfWork: adapters.unitOfWork,
      clock: adapters.clock,
      ids: adapters.ids,
    },
    modules: {
      account: stub as never,
      users: stub as never,
      patient: stub as never,
      record: stub as never,
      attachments: stub as never,
      agenda: stub as never,
      consultation: stub as never,
      admission: stub as never,
      procedure: stub as never,
      discharge: stub as never,
      referral: stub as never,
      growth: stub as never,
      vaccines: stub as never,
      milestones: stub as never,
      labIntake: stub as never,
      labResults: stub as never,
      dentalChart: stub as never,
      dentalPlan: stub as never,
      dentalSession: stub as never,
      personnel: stub as never,
      honoraria: stub as never,
      inventory: stub as never,
      charges,
      invoicing: stub as never,
      payments: stub as never,
      history: stub as never,
    },
    unitOfWork: adapters.unitOfWork,
    clock: adapters.clock,
    ids: adapters.ids,
  };
  contextHolder.current = context;

  const harness: FullHarness = {
    context,
    actor,
    async reset(): Promise<void> {
      clearClinical(adapters.memoryState);
      resetExtensionRegistryForTests();
      registerExtensionNamespace('charges');
      seedCatalogs(adapters.memoryState, institutionId);
      store.clearFailAfterWrite();
      store.setUnavailable(false);
    },
    async counts(): Promise<Record<string, number>> {
      const maps = adapters.memoryState.getPublished();
      return {
        pacientes: maps.pacientes.size,
        expedientes: maps.expedientes.size,
        ...store.counts(),
      };
    },
    async nativeSnapshot(): Promise<Record<string, string>> {
      return {
        charges: hashChargesSnapshot(store.snapshotRows()),
        clinical: createHash('sha256')
          .update(
            JSON.stringify({
              p: mapsSize(adapters),
            }),
          )
          .digest('hex'),
      };
    },
    failAfterWrite(n: number): void {
      store.failAfterWrite(n);
    },
    async otherInstitution(): Promise<FullHarness> {
      return buildHarness(OTHER_INSTITUTION_ID, sequences);
    },
    async close(): Promise<void> {},
    async seedPatient(doc = 'DOC-CHARGE'): Promise<{ id_paciente: number; id_expediente: number }> {
      const resumen = await adapters.pacientes.createWithExpediente(
        baseRegisterInput({ numero_documento: doc }),
      );
      return {
        id_paciente: resumen.paciente.id_paciente,
        id_expediente: resumen.expediente.id_expediente,
      };
    },
    seedServicio(overrides: Partial<SERVICIO_FACTURABLE> = {}): SERVICIO_FACTURABLE {
      const servicio: SERVICIO_FACTURABLE = {
        codigo_servicio: 'CONS-01',
        id_institucion: institutionId,
        nombre: 'Consulta general',
        tipo: 'consulta',
        precio_unitario: '100.00',
        unidad: 'sesión',
        afecto_iva: true,
        vigente: true,
        ...overrides,
      };
      store.seedServicio(servicio);
      return servicio;
    },
    setStoreUnavailable(value: boolean): void {
      store.setUnavailable(value);
    },
    withActor(patch: Partial<OperationContext>): OperationContext {
      return { ...actor, ...patch, id_institucion: asInstitutionId(institutionId) };
    },
  };
  return harness;
}

function mapsSize(adapters: ReturnType<typeof createTestMemoryAdapterSet>): number {
  const maps = adapters.memoryState.getPublished();
  return maps.pacientes.size + maps.expedientes.size;
}

moduleContract(
  'memory',
  async () => {
    const sequences = new MemoryIdPort();
    return buildHarness(1, sequences);
  },
  [68, 69],
);

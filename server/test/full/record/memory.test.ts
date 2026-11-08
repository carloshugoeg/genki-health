import { createHash } from 'node:crypto';
import { createTestMemoryAdapterSet } from '../../../src/config/memory-test-factory.js';
import {
  getExtensionNamespace,
  registerExtensionNamespace,
  resetExtensionRegistryForTests,
} from '../../../src/adapters/memory/full-state.js';
import { MemoryIdPort } from '../../../src/adapters/memory/id.js';
import { activeMemoryMaps } from '../../../src/adapters/memory/unit-of-work.js';
import type { MemoryInstitutionState } from '../../../src/adapters/memory/state.js';
import { archiveExpediente } from '../../../src/application/archive-expediente.js';
import type {
  FullContext,
  FullModulePorts,
  OperationContext,
} from '../../../src/ports/full/context.js';
import type { RecordRepositoryPort } from '../../../src/ports/full/record.js';
import { FULL_MODULE_SLUGS } from '../../../src/ports/full/context.js';
import {
  OTHER_INSTITUTION_ID,
  SEED_MUNICIPIO_ID,
  defaultKind,
  expectedInstitution99Catalog,
  expectedPrimaryCatalog,
  SEED_CIE10,
} from '../../../src/testing/catalog-seeds.js';
import { recordContract, type FullHarness } from '../record.contract.js';

type MemoryRecordFactory = (deps: {
  state: MemoryInstitutionState;
  pacientes: FullContext['base']['pacientes'];
  ids: FullContext['ids'];
  unitOfWork: FullContext['unitOfWork'];
  clock: FullContext['clock'];
  isStoreUnavailable: () => boolean;
  afterWrite: () => void;
}) => RecordRepositoryPort & { resetForTests?: () => void };

async function loadMemoryRecordFactory(): Promise<MemoryRecordFactory> {
  const mod = (await import('../../../src/adapters/memory/full/record.js')) as {
    createMemoryRecordRepository?: MemoryRecordFactory;
  };
  if (typeof mod.createMemoryRecordRepository !== 'function') {
    throw new Error('createMemoryRecordRepository missing');
  }
  return mod.createMemoryRecordRepository;
}

function seedCatalogs(state: MemoryInstitutionState, institutionId: number): void {
  const catalog =
    institutionId === OTHER_INSTITUTION_ID
      ? expectedInstitution99Catalog()
      : expectedPrimaryCatalog();
  const catalogs = state.getPublished().catalogs;
  catalogs.municipios.clear();
  catalogs.profesionales.clear();
  catalogs.medicamentos.clear();
  catalogs.cie10.clear();
  for (const row of catalog.municipios) {
    catalogs.municipios.set(row.id_municipio, row);
  }
  for (const row of catalog.profesionales) {
    catalogs.profesionales.set(row.id_profesional, { ...row, activo: true });
  }
  for (const row of catalog.medicamentos) {
    catalogs.medicamentos.set(row.id_medicamento, { ...row, activo: true });
  }
  catalogs.cie10.set(SEED_CIE10, { codigo_cie10: SEED_CIE10, descripcion: 'Examen general' });
}

function clearClinical(state: MemoryInstitutionState): void {
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
  const record = maps.extensions?.get('record');
  if (record) {
    record.clear();
  }
}

function stubModules(record: RecordRepositoryPort): FullModulePorts {
  const missing = new Proxy(
    {},
    {
      get(_target, prop) {
        if (prop === 'then') return undefined;
        return () => {
          throw new Error(`module port not wired in FS-04-C01 harness: ${String(prop)}`);
        };
      },
    },
  );
  const modules = {} as FullModulePorts;
  for (const slug of FULL_MODULE_SLUGS) {
    const key =
      slug === 'lab-intake'
        ? 'labIntake'
        : slug === 'lab-results'
          ? 'labResults'
          : slug === 'dental-chart'
            ? 'dentalChart'
            : slug === 'dental-plan'
              ? 'dentalPlan'
              : slug === 'dental-session'
                ? 'dentalSession'
                : slug;
    (modules as Record<string, unknown>)[key] = slug === 'record' ? record : missing;
  }
  return modules;
}

function hashRows(rows: Map<string | number, unknown> | undefined): string {
  if (!rows || rows.size === 0) {
    return createHash('sha256').update('empty').digest('hex');
  }
  const ordered = [...rows.entries()]
    .map(([id, row]) => ({ id, keys: Object.keys(row as object).sort() }))
    .sort((a, b) => String(a.id).localeCompare(String(b.id)));
  return createHash('sha256').update(JSON.stringify(ordered)).digest('hex');
}

function makeActor(institutionId: number): OperationContext {
  return {
    id_institucion: institutionId as OperationContext['id_institucion'],
    id_usuario: 10,
    id_profesional: 1,
    roles: ['medico'],
    permissions: ['ficha.leer', 'antecedente.escribir'],
    now: '2026-11-08T18:00:00.000Z',
  };
}

async function buildHarness(institutionId: number, sequences: MemoryIdPort): Promise<FullHarness> {
  resetExtensionRegistryForTests();
  registerExtensionNamespace('record');
  const createMemoryRecordRepository = await loadMemoryRecordFactory();

  let writesUntilFail: number | null = null;
  let storeDown = false;
  const afterRecordWrite = (): void => {
    if (writesUntilFail === null) {
      return;
    }
    if (writesUntilFail <= 1) {
      writesUntilFail = null;
      const err = new Error('injected mid-write failure') as Error & { code: string };
      err.code = 'internal_error';
      throw err;
    }
    writesUntilFail -= 1;
  };

  const primary = createTestMemoryAdapterSet(defaultKind(), institutionId, {
    ids: sequences,
  });
  seedCatalogs(primary.memoryState, institutionId);

  const record = createMemoryRecordRepository({
    state: primary.memoryState,
    pacientes: primary.pacientes,
    ids: primary.ids,
    unitOfWork: primary.unitOfWork,
    clock: primary.clock,
    isStoreUnavailable: () => storeDown,
    afterWrite: afterRecordWrite,
  });

  const context: FullContext = {
    base: {
      pacientes: primary.pacientes,
      consultas: primary.consultas,
      catalogos: primary.catalogos,
      unitOfWork: primary.unitOfWork,
      clock: primary.clock,
      ids: primary.ids,
    },
    modules: stubModules(record),
    unitOfWork: primary.unitOfWork,
    clock: primary.clock,
    ids: primary.ids,
  };

  const actor = makeActor(institutionId);

  const harness: FullHarness = {
    context,
    actor,
    async reset(): Promise<void> {
      writesUntilFail = null;
      storeDown = false;
      clearClinical(primary.memoryState);
      seedCatalogs(primary.memoryState, institutionId);
      record.resetForTests?.();
    },
    async counts(): Promise<Record<string, number>> {
      const maps = activeMemoryMaps(primary.memoryState);
      const ns = getExtensionNamespace(maps, 'record');
      return {
        pacientes: maps.pacientes.size,
        expedientes: maps.expedientes.size,
        antecedentes: ns.get('antecedentes')?.size ?? 0,
        alergias: ns.get('alergias')?.size ?? 0,
      };
    },
    async nativeSnapshot(): Promise<Record<string, string>> {
      const maps = activeMemoryMaps(primary.memoryState);
      const ns = getExtensionNamespace(maps, 'record');
      return {
        pacientes: hashRows(maps.pacientes as Map<string | number, unknown>),
        expedientes: hashRows(maps.expedientes as Map<string | number, unknown>),
        antecedentes: hashRows(ns.get('antecedentes')),
        alergias: hashRows(ns.get('alergias')),
        expediente_estados: createHash('sha256')
          .update(
            JSON.stringify(
              [...maps.expedientes.values()]
                .map((row) => ({ id: row.id_expediente, estado: row.estado }))
                .sort((a, b) => a.id - b.id),
            ),
          )
          .digest('hex'),
      };
    },
    failAfterWrite(n: number): void {
      writesUntilFail = n;
    },
    setStoreUnavailable(flag: boolean): void {
      storeDown = flag;
    },
    withActor(next: OperationContext): FullHarness {
      return { ...harness, actor: next };
    },
    async seedActivePatient(doc: string): Promise<{ id_paciente: number; id_expediente: number }> {
      const resumen = await primary.pacientes.createWithExpediente({
        tipo_documento: 'DPI',
        numero_documento: doc,
        primer_nombre: 'Ana',
        segundo_nombre: null,
        primer_apellido: 'Lopez',
        segundo_apellido: null,
        fecha_nacimiento: '1990-01-15',
        sexo: 'F',
        tipo_sangre: null,
        telefono: null,
        correo: null,
        direccion: null,
        id_municipio: SEED_MUNICIPIO_ID,
      });
      return {
        id_paciente: resumen.paciente.id_paciente,
        id_expediente: resumen.expediente.id_expediente,
      };
    },
    async seedArchivedPatient(
      doc: string,
    ): Promise<{ id_paciente: number; id_expediente: number }> {
      const seeded = await harness.seedActivePatient(doc);
      await archiveExpediente(primary.pacientes, primary.clock, {
        id_paciente: seeded.id_paciente as never,
        id_expediente: seeded.id_expediente as never,
        motivo_archivo: 'administrativo',
      });
      return seeded;
    },
    async otherInstitution(): Promise<FullHarness> {
      return buildHarness(OTHER_INSTITUTION_ID, sequences);
    },
    async close(): Promise<void> {},
  };

  return harness;
}

recordContract(
  'memory',
  async () => {
    const sequences = new MemoryIdPort();
    return buildHarness(1, sequences);
  },
  [12, 15],
);

import { createHash } from 'node:crypto';
import { asInstitutionId, type PacienteId } from '@genki/shared';
import type { CITA } from '@genki/shared/full/agenda';
import { describe, expect, it } from 'vitest';
import {
  getExtensionNamespace,
  registerExtensionNamespace,
} from '../../../src/adapters/memory/full-state.js';
import { activeMemoryMaps } from '../../../src/adapters/memory/unit-of-work.js';
import { createTestMemoryAdapterSet } from '../../../src/config/memory-test-factory.js';
import type { FullContext, OperationContext } from '../../../src/ports/full/context.js';
import {
  OTHER_INSTITUTION_ID,
  SEED_PROFESIONAL_ID,
  defaultKind,
  expectedInstitution99Catalog,
  expectedPrimaryCatalog,
} from '../../../src/testing/catalog-seeds.js';
import { FIXTURE, moduleContract, type FullHarness } from '../agenda.contract.js';

const AGENDA_SLUG = 'agenda';
let agendaRegistered = false;

function ensureAgendaNamespace(): void {
  if (agendaRegistered) {
    return;
  }
  try {
    registerExtensionNamespace(AGENDA_SLUG);
    agendaRegistered = true;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (!/duplicate/i.test(message)) {
      throw err;
    }
    agendaRegistered = true;
  }
}

function seedCatalog(
  state: ReturnType<typeof createTestMemoryAdapterSet>['memoryState'],
  institutionId: number,
): void {
  const catalog =
    institutionId === OTHER_INSTITUTION_ID
      ? expectedInstitution99Catalog()
      : expectedPrimaryCatalog();
  const maps = state.getPublished();
  maps.catalogs.municipios.clear();
  maps.catalogs.profesionales.clear();
  maps.catalogs.medicamentos.clear();
  maps.catalogs.cie10.clear();
  for (const row of catalog.municipios) {
    maps.catalogs.municipios.set(row.id_municipio, row);
  }
  for (const row of catalog.profesionales) {
    maps.catalogs.profesionales.set(row.id_profesional, { ...row, activo: true });
  }
  for (const row of catalog.medicamentos) {
    maps.catalogs.medicamentos.set(row.id_medicamento, { ...row, activo: true });
  }
}

function citaFingerprint(row: CITA): Record<string, unknown> {
  return {
    id_cita: row.id_cita,
    id_profesional: row.id_profesional,
    fecha_hora: row.fecha_hora,
    duracion_minutos: row.duracion_minutos,
    estado: row.estado,
  };
}

function hashRows(rows: unknown[]): string {
  return createHash('sha256').update(JSON.stringify(rows)).digest('hex');
}

function clearAgenda(state: ReturnType<typeof createTestMemoryAdapterSet>['memoryState']): void {
  const maps = state.getPublished();
  maps.pacientes.clear();
  maps.expedientes.clear();
  maps.responsables.clear();
  const ns = getExtensionNamespace(maps, AGENDA_SLUG);
  ns.clear();
}

type MemoryAgendaAdapter = {
  op20: FullContext['modules']['agenda']['op20'];
  op21: FullContext['modules']['agenda']['op21'];
  failAfterWrite(n: number): void;
  setStoreUnavailable(value: boolean): void;
  resetTestHooks(): void;
};

async function loadMemoryAgendaAdapter(): Promise<{
  createMemoryAgendaAdapter: (deps: {
    state: ReturnType<typeof createTestMemoryAdapterSet>['memoryState'];
    ids: ReturnType<typeof createTestMemoryAdapterSet>['ids'];
    unitOfWork: ReturnType<typeof createTestMemoryAdapterSet>['unitOfWork'];
    institutionId: ReturnType<typeof asInstitutionId>;
  }) => MemoryAgendaAdapter;
}> {
  return import('../../../src/adapters/memory/full/agenda.js') as Promise<{
    createMemoryAgendaAdapter: (deps: {
      state: ReturnType<typeof createTestMemoryAdapterSet>['memoryState'];
      ids: ReturnType<typeof createTestMemoryAdapterSet>['ids'];
      unitOfWork: ReturnType<typeof createTestMemoryAdapterSet>['unitOfWork'];
      institutionId: ReturnType<typeof asInstitutionId>;
    }) => MemoryAgendaAdapter;
  }>;
}

async function buildHarness(institutionId: number): Promise<FullHarness> {
  ensureAgendaNamespace();
  const { createMemoryAgendaAdapter } = await loadMemoryAgendaAdapter();
  const set = createTestMemoryAdapterSet(defaultKind(), institutionId);
  seedCatalog(set.memoryState, institutionId);

  const agenda = createMemoryAgendaAdapter({
    state: set.memoryState,
    ids: set.ids,
    unitOfWork: set.unitOfWork,
    institutionId: asInstitutionId(institutionId),
  });

  const actor: OperationContext = {
    id_institucion: asInstitutionId(institutionId),
    id_usuario: 7,
    id_profesional: null,
    roles: ['recepcion'],
    permissions: [],
    now: FIXTURE.now,
  };

  const context = {
    base: {
      pacientes: set.pacientes,
      consultas: set.consultas,
      catalogos: set.catalogos,
      unitOfWork: set.unitOfWork,
      clock: set.clock,
      ids: set.ids,
    },
    modules: { agenda } as FullContext['modules'],
    unitOfWork: set.unitOfWork,
    clock: set.clock,
    ids: set.ids,
  } as FullContext;

  return {
    context,
    actor,
    async reset(): Promise<void> {
      clearAgenda(set.memoryState);
      seedCatalog(set.memoryState, institutionId);
      agenda.resetTestHooks();
    },
    async counts(): Promise<Record<string, number>> {
      const maps = set.memoryState.getPublished();
      const ns = getExtensionNamespace(maps, AGENDA_SLUG);
      const citas = ns.get('citas')?.size ?? 0;
      const locks = ns.get('agenda_locks')?.size ?? 0;
      return {
        pacientes: maps.pacientes.size,
        expedientes: maps.expedientes.size,
        citas,
        agenda_locks: locks,
      };
    },
    async nativeSnapshot(): Promise<Record<string, string>> {
      const maps = set.memoryState.getPublished();
      const ns = getExtensionNamespace(maps, AGENDA_SLUG);
      const citas = [...(ns.get('citas')?.values() ?? [])] as CITA[];
      citas.sort((a, b) => a.id_cita - b.id_cita);
      const locks = [...(ns.get('agenda_locks')?.entries() ?? [])]
        .map(([key, value]) => ({ key, value }))
        .sort((a, b) => String(a.key).localeCompare(String(b.key)));
      return {
        citas: hashRows(citas.map(citaFingerprint)),
        agenda_locks: hashRows(locks),
      };
    },
    failAfterWrite(n: number): void {
      agenda.failAfterWrite(n);
    },
    setStoreUnavailable(): void {
      agenda.setStoreUnavailable(true);
    },
    async otherInstitution(): Promise<FullHarness> {
      return buildHarness(OTHER_INSTITUTION_ID);
    },
    async close(): Promise<void> {},
    async seedPatient(doc: string): Promise<{ id_paciente: number }> {
      const resumen = await set.pacientes.createWithExpediente({
        tipo_documento: 'DPI',
        numero_documento: doc,
        primer_nombre: 'Agenda',
        primer_apellido: 'Fixture',
        fecha_nacimiento: '1990-01-15',
        sexo: 'F',
      });
      return { id_paciente: resumen.paciente.id_paciente as PacienteId };
    },
    async seedBusyCita(input): Promise<CITA> {
      return set.unitOfWork.runInTransaction(async () => {
        const working = activeMemoryMaps(set.memoryState);
        const ns = getExtensionNamespace(working, AGENDA_SLUG);
        const id = await set.ids.nextInt('cita');
        const row: CITA = {
          id_cita: id,
          id_paciente: input.id_paciente,
          id_profesional: input.id_profesional,
          id_especialidad: null,
          fecha_hora: input.fecha_hora,
          duracion_minutos: input.duracion_minutos,
          motivo: null,
          estado: input.estado ?? 'programada',
          id_usuario_registra: actor.id_usuario,
          fecha_creacion: actor.now,
        };
        let table = ns.get('citas');
        if (!table) {
          table = new Map();
          ns.set('citas', table);
        }
        table.set(id, structuredClone(row));
        return structuredClone(row);
      });
    },
  };
}

async function makeMemoryAgendaHarness(): Promise<FullHarness> {
  return buildHarness(1);
}

moduleContract('memory', makeMemoryAgendaHarness, [20, 21, 22, 23, 24, 25]);

describe('agenda memory factory smoke', () => {
  it('seeds primary professional id used by fixtures', async () => {
    ensureAgendaNamespace();
    const set = createTestMemoryAdapterSet(defaultKind(), 1);
    seedCatalog(set.memoryState, 1);
    expect(SEED_PROFESIONAL_ID).toBe(FIXTURE.profesional);
    const catalogs = await set.catalogos.list();
    expect(catalogs.profesionales.some((p) => p.id_profesional === FIXTURE.profesional)).toBe(true);
  });
});

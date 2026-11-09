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
import type { AttachmentsRepositoryPort } from '../../../src/ports/full/attachments.js';
import { FULL_MODULE_SLUGS } from '../../../src/ports/full/context.js';
import {
  OTHER_INSTITUTION_ID,
  SEED_MUNICIPIO_ID,
  defaultKind,
  expectedInstitution99Catalog,
  expectedPrimaryCatalog,
  SEED_CIE10,
} from '../../../src/testing/catalog-seeds.js';
import { attachmentsContract, type FullHarness } from '../attachments.contract.js';

type MemoryAttachmentsFactory = (deps: {
  state: MemoryInstitutionState;
  pacientes: FullContext['base']['pacientes'];
  ids: FullContext['ids'];
  unitOfWork: FullContext['unitOfWork'];
  clock: FullContext['clock'];
  isStoreUnavailable: () => boolean;
  afterWrite: () => void;
}) => AttachmentsRepositoryPort & { resetForTests?: () => void };

async function loadMemoryAttachmentsFactory(): Promise<MemoryAttachmentsFactory> {
  const mod = (await import('../../../src/adapters/memory/full/attachments.js')) as {
    createMemoryAttachmentsRepository?: MemoryAttachmentsFactory;
  };
  if (typeof mod.createMemoryAttachmentsRepository !== 'function') {
    throw new Error('createMemoryAttachmentsRepository missing');
  }
  return mod.createMemoryAttachmentsRepository;
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
  const attachments = maps.extensions?.get('attachments');
  if (attachments) {
    attachments.clear();
  }
}

function stubModules(attachments: AttachmentsRepositoryPort): FullModulePorts {
  const missing = new Proxy(
    {},
    {
      get(_target, prop) {
        if (prop === 'then') return undefined;
        return () => {
          throw new Error(`module port not wired in FS-05-C01 harness: ${String(prop)}`);
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
    (modules as Record<string, unknown>)[key] = slug === 'attachments' ? attachments : missing;
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
    permissions: ['documento.adjuntar'],
    now: '2026-11-08T18:00:00.000Z',
  };
}

async function buildHarness(institutionId: number, sequences: MemoryIdPort): Promise<FullHarness> {
  resetExtensionRegistryForTests();
  registerExtensionNamespace('attachments');
  const createMemoryAttachmentsRepository = await loadMemoryAttachmentsFactory();

  let writesUntilFail: number | null = null;
  let storeDown = false;
  const afterAttachmentsWrite = (): void => {
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

  const attachments = createMemoryAttachmentsRepository({
    state: primary.memoryState,
    pacientes: primary.pacientes,
    ids: primary.ids,
    unitOfWork: primary.unitOfWork,
    clock: primary.clock,
    isStoreUnavailable: () => storeDown,
    afterWrite: afterAttachmentsWrite,
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
    modules: stubModules(attachments),
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
      attachments.resetForTests?.();
    },
    async counts(): Promise<Record<string, number>> {
      const maps = activeMemoryMaps(primary.memoryState);
      const ns = getExtensionNamespace(maps, 'attachments');
      return {
        pacientes: maps.pacientes.size,
        expedientes: maps.expedientes.size,
        documentos: ns.get('documentos')?.size ?? 0,
        contenido: ns.get('contenido')?.size ?? 0,
        temps: ns.get('temps')?.size ?? 0,
      };
    },
    async nativeSnapshot(): Promise<Record<string, string>> {
      const maps = activeMemoryMaps(primary.memoryState);
      const ns = getExtensionNamespace(maps, 'attachments');
      return {
        pacientes: hashRows(maps.pacientes as Map<string | number, unknown>),
        expedientes: hashRows(maps.expedientes as Map<string | number, unknown>),
        documentos: hashRows(ns.get('documentos')),
        contenido: hashRows(ns.get('contenido')),
        temps: hashRows(ns.get('temps')),
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

attachmentsContract(
  'memory',
  async () => {
    const sequences = new MemoryIdPort();
    return buildHarness(1, sequences);
  },
  [17],
);

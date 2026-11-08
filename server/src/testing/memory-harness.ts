import type {
  CloseConsultaRequest,
  ConsultaCompleta,
  InstitutionKind,
  PacienteId,
} from '@genki/shared';
import type { MemoryInstitutionState } from '../adapters/memory/state.js';
import { MemoryIdPort } from '../adapters/memory/id.js';
import { closeConsulta } from '../application/close-consulta.js';
import { createTestMemoryAdapterSet } from '../config/memory-test-factory.js';
import type { PersistenceCheckpoint } from '../ports/adapter-resource.js';
import type { CloseConsultaBundle } from '../ports/consulta-repository.js';
import type { ClinicalContext } from '../ports/clinical-context.js';
import type {
  ClinicalHarness,
  ContractClinicalContext,
  ContractConsultaRepository,
  CountSnapshot,
  FailurePoint,
} from './harness.js';
import {
  defaultKind,
  expectedInstitution99Catalog,
  expectedPrimaryCatalog,
  OTHER_INSTITUTION_ID,
  SEED_CIE10,
} from './catalog-seeds.js';

function countsOf(state: MemoryInstitutionState): CountSnapshot {
  const maps = state.getPublished();
  return {
    pacientes: maps.pacientes.size,
    expedientes: maps.expedientes.size,
    responsables: maps.responsables.size,
    consultas: maps.consultas.size,
    diagnosticos: maps.diagnosticos.size,
    tratamientos: maps.tratamientos.size,
    recetas: maps.recetas.size,
    detalles: maps.detalles.size,
  };
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

function isCloseBundle(
  input: CloseConsultaBundle | { id_paciente: PacienteId; body: CloseConsultaRequest },
): input is CloseConsultaBundle {
  return 'consulta' in input && 'diagnosticos' in input && 'tratamientos' in input;
}

function facadeConsultas(context: ClinicalContext): ContractConsultaRepository {
  return {
    closeConsulta(
      input: CloseConsultaBundle | { id_paciente: PacienteId; body: CloseConsultaRequest },
    ): Promise<ConsultaCompleta> {
      if (isCloseBundle(input)) {
        return context.consultas.closeConsulta(input);
      }
      return closeConsulta(context, input);
    },
    findById: (id) => context.consultas.findById(id),
    listByExpediente: (id) => context.consultas.listByExpediente(id),
  };
}

function asContractContext(context: ClinicalContext): ContractClinicalContext {
  return {
    pacientes: context.pacientes,
    consultas: facadeConsultas(context),
    catalogos: context.catalogos,
    unitOfWork: context.unitOfWork,
    clock: context.clock,
    ids: context.ids,
  };
}

export async function makeMemoryClinicalHarness(options?: {
  kind?: InstitutionKind;
}): Promise<ClinicalHarness> {
  const kind = options?.kind ?? defaultKind();
  let pending: FailurePoint | null = null;
  const afterWrite = (point: PersistenceCheckpoint): void => {
    if (pending === point) {
      pending = null;
      throw new Error(`checkpoint ${point}`);
    }
  };
  const sequences = new MemoryIdPort();
  const primary = createTestMemoryAdapterSet(kind, 1, { ids: sequences, afterWrite });
  seedCatalogs(primary.memoryState, 1);

  return {
    context: asContractContext(primary),
    async reset(): Promise<void> {
      clearClinical(primary.memoryState);
      seedCatalogs(primary.memoryState, 1);
    },
    failNext(point: FailurePoint): void {
      pending = point;
    },
    async counts(): Promise<CountSnapshot> {
      return countsOf(primary.memoryState);
    },
    async otherInstitution(): Promise<ContractClinicalContext> {
      const other = createTestMemoryAdapterSet(kind, OTHER_INSTITUTION_ID, {
        ids: sequences,
        afterWrite,
      });
      seedCatalogs(other.memoryState, OTHER_INSTITUTION_ID);
      return asContractContext(other);
    },
    async close(): Promise<void> {},
  };
}

import { asInstitutionId, type InstitutionKind } from '@genki/shared';
import { createMemoryAdapterSet } from '../../src/config/compose-memory.js';
import type {
  ClinicalHarness,
  ContractClinicalContext,
  CountSnapshot,
  FailurePoint,
} from './harness.js';
import { defaultKind, OTHER_INSTITUTION_ID } from './fixtures.js';

type MemoryBags = {
  pacientes?: Map<unknown, unknown>;
  expedientes?: Map<unknown, unknown>;
  responsables?: Map<unknown, unknown>;
  consultas?: Map<unknown, unknown>;
  diagnosticos?: Map<unknown, unknown>;
  tratamientos?: Map<unknown, unknown>;
  recetas?: Map<unknown, unknown>;
  detalles?: Map<unknown, unknown>;
};

function emptyCounts(): CountSnapshot {
  return {
    pacientes: 0,
    expedientes: 0,
    responsables: 0,
    consultas: 0,
    diagnosticos: 0,
    tratamientos: 0,
    recetas: 0,
    detalles: 0,
  };
}

function readCounts(bags: MemoryBags): CountSnapshot {
  return {
    pacientes: bags.pacientes?.size ?? 0,
    expedientes: bags.expedientes?.size ?? 0,
    responsables: bags.responsables?.size ?? 0,
    consultas: bags.consultas?.size ?? 0,
    diagnosticos: bags.diagnosticos?.size ?? 0,
    tratamientos: bags.tratamientos?.size ?? 0,
    recetas: bags.recetas?.size ?? 0,
    detalles: bags.detalles?.size ?? 0,
  };
}

function clearBags(bags: MemoryBags): void {
  for (const map of Object.values(bags)) {
    map?.clear();
  }
}

/**
 * Memory harness for the frozen suite.
 * Casts the current scaffold adapter set through unknown to the structural
 * ContractClinicalContext. Missing methods and absent snapshot rollback fail
 * at runtime under CONTRACT_RED=1 until later memory tickets.
 */
export async function makeMemoryClinicalHarness(options?: {
  kind?: InstitutionKind;
}): Promise<ClinicalHarness> {
  const kind = options?.kind ?? defaultKind();
  const institutionId = 1;
  const primarySet = createMemoryAdapterSet(kind, institutionId);
  let pendingFailure: FailurePoint | null = null;

  const afterWrite = (point: FailurePoint): void => {
    if (pendingFailure === point) {
      pendingFailure = null;
      throw new Error(`injected failure at ${point}`);
    }
  };

  // Existing compose path does not accept afterWrite; keep callback local for
  // future wiring. failNext still arms so cases exercise the harness API.
  void afterWrite;

  const bags: MemoryBags = {
    pacientes: (primarySet.pacientes as unknown as { pacientes?: Map<unknown, unknown> }).pacientes,
    expedientes: (primarySet.pacientes as unknown as { expedientes?: Map<unknown, unknown> })
      .expedientes,
  };

  const context = primarySet as unknown as ContractClinicalContext;

  const otherInstitution = async (): Promise<ContractClinicalContext> => {
    const other = createMemoryAdapterSet(kind, OTHER_INSTITUTION_ID);
    void asInstitutionId(OTHER_INSTITUTION_ID);
    return other as unknown as ContractClinicalContext;
  };

  return {
    context,
    async reset(): Promise<void> {
      clearBags(bags);
      pendingFailure = null;
    },
    failNext(point: FailurePoint): void {
      pendingFailure = point;
    },
    async counts(): Promise<CountSnapshot> {
      if (!bags.pacientes && !bags.expedientes) {
        return emptyCounts();
      }
      return readCounts(bags);
    },
    otherInstitution,
    async close(): Promise<void> {
      pendingFailure = null;
    },
  };
}

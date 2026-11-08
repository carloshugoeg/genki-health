import { asInstitutionId, engineForKind, type InstitutionKind } from '@genki/shared';
import {
  MemoryCatalogoRepository,
  MemoryIdPort,
  MemoryPacienteRepository,
  MemoryUnitOfWork,
  SystemClock,
} from '../adapters/memory/index.js';
import {
  createMemoryInstitutionState,
  type MemoryInstitutionState,
} from '../adapters/memory/state.js';
import type { PersistenceCheckpoint } from '../ports/index.js';
import type { AdapterSet } from './adapter-registry.js';

export interface MemoryAdapterOptions {
  afterWrite?: (point: PersistenceCheckpoint) => void;
}

export function openMemoryAdapterSet(
  kind: InstitutionKind,
  institutionId: number,
  options?: MemoryAdapterOptions,
): { set: AdapterSet; state: MemoryInstitutionState } {
  const clock = new SystemClock();
  const ids = new MemoryIdPort();
  const state = createMemoryInstitutionState();
  const unitOfWork = new MemoryUnitOfWork(state);
  const set: AdapterSet = {
    engine: engineForKind(kind),
    clock,
    ids,
    unitOfWork,
    pacientes: new MemoryPacienteRepository(
      state,
      ids,
      unitOfWork,
      asInstitutionId(institutionId),
      kind,
      () => clock.nowIso(),
      options?.afterWrite,
    ),
    catalogos: new MemoryCatalogoRepository(state),
  };
  return { set, state };
}

export function buildMemoryAdapterSet(
  kind: InstitutionKind,
  institutionId: number,
  options?: MemoryAdapterOptions,
): AdapterSet {
  return openMemoryAdapterSet(kind, institutionId, options).set;
}

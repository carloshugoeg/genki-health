import { asInstitutionId, engineForKind, type InstitutionKind } from '@genki/shared';
import {
  MemoryIdPort,
  MemoryPacienteRepository,
  MemoryUnitOfWork,
  SystemClock,
} from '../adapters/memory/index.js';
import { createMemoryInstitutionState } from '../adapters/memory/state.js';
import type { AdapterSet } from './adapter-registry.js';

export function buildMemoryAdapterSet(kind: InstitutionKind, institutionId: number): AdapterSet {
  const clock = new SystemClock();
  const ids = new MemoryIdPort();
  const state = createMemoryInstitutionState();
  return {
    engine: engineForKind(kind),
    clock,
    ids,
    unitOfWork: new MemoryUnitOfWork(state),
    pacientes: new MemoryPacienteRepository(state, ids, asInstitutionId(institutionId), () =>
      clock.nowIso(),
    ),
  };
}

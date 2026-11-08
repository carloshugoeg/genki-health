import { asInstitutionId, engineForKind, type InstitutionKind } from '@genki/shared';
import {
  MemoryAuthAdapter,
  MemoryIdPort,
  MemoryPacienteRepository,
  MemoryUnitOfWork,
  SystemClock,
} from '../adapters/memory/index.js';
import { createMemoryInstitutionState } from '../adapters/memory/state.js';
import type { AuthPort } from '../ports/index.js';
import { InstitutionAdapterRegistry, type AdapterSet } from './adapter-registry.js';

export function createMemoryAdapterSet(kind: InstitutionKind, institutionId = 1): AdapterSet {
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

/** Phase-0 composition root: clinical adapters on memory; AuthPort is platform-wide. */
export function createPhase0Registry(): InstitutionAdapterRegistry {
  const registry = new InstitutionAdapterRegistry();
  const kinds: InstitutionKind[] = [
    'hospital_general',
    'centro_pediatrico',
    'laboratorio_clinico',
    'clinica_odontologica',
  ];
  for (const kind of kinds) {
    registry.register(kind, (institutionId) => createMemoryAdapterSet(kind, institutionId));
  }
  return registry;
}

export async function createPhase0Auth(jwtSecret: string): Promise<AuthPort> {
  return MemoryAuthAdapter.create({ jwtSecret });
}

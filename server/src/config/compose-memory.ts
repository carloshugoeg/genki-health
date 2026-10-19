import { asInstitutionId, engineForKind, type InstitutionKind } from '@genki/shared';
import {
  MemoryIdPort,
  MemoryPacienteRepository,
  MemoryUnitOfWork,
  NeedsHumanAuthAdapter,
  SystemClock,
} from '../adapters/memory/index.js';
import { InstitutionAdapterRegistry, type AdapterSet } from './adapter-registry.js';

export function createMemoryAdapterSet(kind: InstitutionKind, institutionId = 1): AdapterSet {
  const clock = new SystemClock();
  const ids = new MemoryIdPort();
  return {
    engine: engineForKind(kind),
    auth: new NeedsHumanAuthAdapter(),
    clock,
    ids,
    unitOfWork: new MemoryUnitOfWork(),
    pacientes: new MemoryPacienteRepository(ids, asInstitutionId(institutionId), () =>
      clock.nowIso(),
    ),
  };
}

/** Phase-0 composition root: all four institutions point at memory. Real engines later. */
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

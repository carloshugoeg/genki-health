import type { InstitutionKind } from '@genki/shared';
import { createAuthService } from '../adapters/auth/service.js';
import { MemoryIdentityStore, buildDemoUsers } from '../adapters/memory/index.js';
import type { AuthPort } from '../ports/index.js';
import { InstitutionAdapterRegistry } from './adapter-registry.js';
import { buildMemoryAdapterSet } from './memory-adapter-set.js';

export function createPhase0Registry(): InstitutionAdapterRegistry {
  const registry = new InstitutionAdapterRegistry();
  const kinds: InstitutionKind[] = [
    'hospital_general',
    'centro_pediatrico',
    'laboratorio_clinico',
    'clinica_odontologica',
  ];
  for (const kind of kinds) {
    registry.register(kind, (institutionId) => buildMemoryAdapterSet(kind, institutionId));
  }
  return registry;
}

export async function createPhase0Auth(jwtSecret: string): Promise<AuthPort> {
  const identities = new MemoryIdentityStore(await buildDemoUsers());
  return createAuthService({ jwtSecret, identities });
}

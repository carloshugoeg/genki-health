import type { InstitutionKind } from '@genki/shared';
import { createAuthService } from '../adapters/auth/service.js';
import { createMemoryAccountRepository } from '../adapters/memory/full/account.js';
import { createMemoryUsersRepository } from '../adapters/memory/full/users.js';
import { createMemoryIdentityAdmin } from '../adapters/memory/identity-admin.js';
import { buildDemoUsers } from '../adapters/memory/index.js';
import type { AuthPort } from '../ports/index.js';
import type { AccountRepositoryPort } from '../ports/full/account.js';
import type { UsersRepositoryPort } from '../ports/full/users.js';
import type { IdentityUser } from '../ports/identity-store.js';
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

export interface Phase0Identity {
  auth: AuthPort;
  account: AccountRepositoryPort;
  users: UsersRepositoryPort;
}

export async function createPhase0Identity(
  jwtSecret: string,
  users?: IdentityUser[],
): Promise<Phase0Identity> {
  const admin = createMemoryIdentityAdmin(users ?? (await buildDemoUsers()));
  return {
    auth: createAuthService({ jwtSecret, identities: admin.asIdentityStore() }),
    account: createMemoryAccountRepository(admin),
    users: createMemoryUsersRepository(admin),
  };
}

export async function createPhase0Auth(
  jwtSecret: string,
  users?: IdentityUser[],
): Promise<AuthPort> {
  return (await createPhase0Identity(jwtSecret, users)).auth;
}

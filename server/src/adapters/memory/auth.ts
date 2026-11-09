import * as argon2 from 'argon2';
import { validatePasswordPolicy, type InstitutionKind } from '@genki/shared';
import type {
  IdentityStorePort,
  IdentityUser,
  RefreshSession,
} from '../../ports/identity-store.js';

export interface MemoryIdentityStoreOptions {
  users?: IdentityUser[];
}

export const DEMO_AUTH_USERS: ReadonlyArray<{
  email: string;
  institution_kind: InstitutionKind;
  id_institucion: number;
  roles: string[];
}> = [
  {
    email: 'hospital@genki.local',
    institution_kind: 'hospital_general',
    id_institucion: 1,
    roles: ['administrador'],
  },
  {
    email: 'pediatrico@genki.local',
    institution_kind: 'centro_pediatrico',
    id_institucion: 2,
    roles: ['medico'],
  },
  {
    email: 'laboratorio@genki.local',
    institution_kind: 'laboratorio_clinico',
    id_institucion: 3,
    roles: ['tecnico'],
  },
  {
    email: 'dental@genki.local',
    institution_kind: 'clinica_odontologica',
    id_institucion: 4,
    roles: ['secretaria'],
  },
];

export async function buildDemoUsers(
  password = process.env.SEED_PASSWORD,
): Promise<IdentityUser[]> {
  if (!password || password.trim().length === 0) {
    throw new Error('SEED_PASSWORD must be set to build demo users');
  }
  const policy = validatePasswordPolicy(password);
  if (policy) {
    throw new Error(`Demo password violates policy: ${policy}`);
  }
  const hash = await argon2.hash(password, { type: argon2.argon2id });
  return DEMO_AUTH_USERS.map((row, index) => ({
    id_usuario: index + 1,
    email: row.email,
    hash_contrasena: hash,
    id_institucion: row.id_institucion,
    institution_kind: row.institution_kind,
    roles: [...row.roles],
    estado: 'activo' as const,
  }));
}

interface StoredRefresh extends RefreshSession {
  revoked_at: string | null;
}

/**
 * Process-local identity + refresh sessions behind IdentityStorePort.
 * JWT crypto lives in adapters/auth/service.ts.
 */
export class MemoryIdentityStore implements IdentityStorePort {
  private readonly users: IdentityUser[];
  private readonly sessions = new Map<string, StoredRefresh>();
  private chain: Promise<unknown> = Promise.resolve();

  constructor(users: IdentityUser[]) {
    this.users = users;
  }

  static async create(options: MemoryIdentityStoreOptions = {}): Promise<MemoryIdentityStore> {
    const users = options.users ?? (await buildDemoUsers());
    return new MemoryIdentityStore(users);
  }

  /** Test helper: count sessions that are not revoked. */
  activeSessionCount(): number {
    let n = 0;
    for (const row of this.sessions.values()) {
      if (row.revoked_at === null) n += 1;
    }
    return n;
  }

  private enqueue<T>(work: () => Promise<T>): Promise<T> {
    const run = this.chain.then(work, work);
    this.chain = run.then(
      () => undefined,
      () => undefined,
    );
    return run;
  }

  async findUser(email: string, kind: InstitutionKind): Promise<IdentityUser | null> {
    const normalized = email.trim().toLowerCase();
    const user = this.users.find(
      (row) => row.email.toLowerCase() === normalized && row.institution_kind === kind,
    );
    return user ?? null;
  }

  async findUserById(id: number): Promise<IdentityUser | null> {
    return this.users.find((row) => row.id_usuario === id) ?? null;
  }

  async insertRefresh(session: RefreshSession): Promise<void> {
    await this.enqueue(async () => {
      this.sessions.set(session.jti_hash, { ...session, revoked_at: null });
    });
  }

  async rotateRefresh(oldHash: string, next: RefreshSession, nowIso: string): Promise<boolean> {
    return this.enqueue(async () => {
      const current = this.sessions.get(oldHash);
      if (!current || current.revoked_at !== null) {
        return false;
      }
      if (Date.parse(current.expires_at) <= Date.parse(nowIso)) {
        current.revoked_at = nowIso;
        return false;
      }
      current.revoked_at = nowIso;
      this.sessions.set(next.jti_hash, { ...next, revoked_at: null });
      return true;
    });
  }

  async revokeRefresh(hash: string, nowIso: string): Promise<void> {
    await this.enqueue(async () => {
      const current = this.sessions.get(hash);
      if (!current) {
        this.sessions.set(hash, {
          jti_hash: hash,
          id_usuario: 0,
          created_at: nowIso,
          expires_at: nowIso,
          revoked_at: nowIso,
        });
        return;
      }
      if (current.revoked_at === null) {
        current.revoked_at = nowIso;
      }
    });
  }
}

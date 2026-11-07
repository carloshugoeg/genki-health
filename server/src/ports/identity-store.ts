import type { InstitutionKind } from '@genki/shared';

export interface IdentityUser {
  id_usuario: number;
  email: string;
  hash_contrasena: string;
  id_institucion: number;
  institution_kind: InstitutionKind;
  roles: string[];
  estado: 'activo' | 'bloqueado' | 'inactivo';
}

export interface RefreshSession {
  jti_hash: string;
  id_usuario: number;
  expires_at: string;
  created_at: string;
}

export interface IdentityStorePort {
  findUser(email: string, kind: InstitutionKind): Promise<IdentityUser | null>;
  findUserById(id: number): Promise<IdentityUser | null>;
  insertRefresh(session: RefreshSession): Promise<void>;
  rotateRefresh(oldHash: string, next: RefreshSession, nowIso: string): Promise<boolean>;
  revokeRefresh(hash: string, nowIso: string): Promise<void>;
}

import type { InstitutionId, UsuarioId } from '@genki/shared';

/**
 * needs-human (Carlos): login flow, JWT claims, password policy, session handling.
 * Do not invent Auth. Callers must treat this port as unavailable until decided.
 */
export class AuthNotConfiguredError extends Error {
  constructor(message = 'AuthPort is blocked pending Carlos human decision') {
    super(message);
    this.name = 'AuthNotConfiguredError';
  }
}

export interface AuthCredentials {
  nombre_usuario: string;
  contrasena: string;
}

export interface AuthSession {
  id_usuario: UsuarioId;
  id_institucion: InstitutionId;
  /** Opaque until JWT claim shape is decided. */
  token: string;
}

export interface AuthPort {
  /**
   * @throws {AuthNotConfiguredError} until Carlos decides Auth.
   */
  login(_credentials: AuthCredentials): Promise<AuthSession>;

  /**
   * @throws {AuthNotConfiguredError} until Carlos decides Auth.
   */
  verifyToken(_token: string): Promise<AuthSession>;
}

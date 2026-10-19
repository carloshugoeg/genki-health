import {
  AuthNotConfiguredError,
  type AuthCredentials,
  type AuthPort,
  type AuthSession,
} from '../../ports/index.js';

/** Fail-closed stub. Auth is needs-human for Carlos. */
export class NeedsHumanAuthAdapter implements AuthPort {
  async login(_credentials: AuthCredentials): Promise<AuthSession> {
    throw new AuthNotConfiguredError();
  }

  async verifyToken(_token: string): Promise<AuthSession> {
    throw new AuthNotConfiguredError();
  }
}

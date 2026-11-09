import type {
  AuthPrincipalDto,
  AuthTokensDto,
  InstitutionKind,
  LoginRequestDto,
} from '@genki/shared';

export class AuthError extends Error {
  constructor(
    message: string,
    readonly code:
      'invalid_credentials' | 'invalid_token' | 'password_policy' | 'misconfigured' | 'forbidden',
  ) {
    super(message);
    this.name = 'AuthError';
  }
}

export type { AuthPrincipalDto, AuthTokensDto, LoginRequestDto };

export interface AuthPort {
  login(input: LoginRequestDto): Promise<AuthTokensDto>;
  refresh(refreshToken: string): Promise<AuthTokensDto>;
  verifyAccessToken(accessToken: string): Promise<AuthPrincipalDto>;
  logout(refreshToken: string): Promise<void>;
  /** Superadmin only: reissue tokens scoped to the chosen institution. */
  selectInstitution(
    accessToken: string,
    refreshToken: string,
    institution_kind: InstitutionKind,
  ): Promise<AuthTokensDto>;
}

export function isInstitutionKind(value: string): value is InstitutionKind {
  return (
    value === 'hospital_general' ||
    value === 'centro_pediatrico' ||
    value === 'laboratorio_clinico' ||
    value === 'clinica_odontologica'
  );
}

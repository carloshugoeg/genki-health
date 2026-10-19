import type { AuthTokensDto, InstitutionKind } from '@genki/shared';

const ACCESS_KEY = 'genki.access_token';
const REFRESH_KEY = 'genki.refresh_token';
const KIND_KEY = 'genki.institution_kind';

export function loadSession(): {
  access_token: string | null;
  refresh_token: string | null;
  institution_kind: InstitutionKind | null;
} {
  return {
    access_token: localStorage.getItem(ACCESS_KEY),
    refresh_token: localStorage.getItem(REFRESH_KEY),
    institution_kind: localStorage.getItem(KIND_KEY) as InstitutionKind | null,
  };
}

export function saveSession(tokens: AuthTokensDto, institution_kind: InstitutionKind): void {
  localStorage.setItem(ACCESS_KEY, tokens.access_token);
  localStorage.setItem(REFRESH_KEY, tokens.refresh_token);
  localStorage.setItem(KIND_KEY, institution_kind);
}

export function clearSession(): void {
  localStorage.removeItem(ACCESS_KEY);
  localStorage.removeItem(REFRESH_KEY);
  localStorage.removeItem(KIND_KEY);
}

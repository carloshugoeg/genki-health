import type { AuthPrincipalDto } from '@genki/shared';

/**
 * Attribution of clinical acts. The JWT carries no professional id (locked Auth claims), so the
 * professional linked to the user (USUARIO.id_profesional, Hospital PostgreSQL identity store) is
 * looked up once per request after the bearer is verified and memoised per user for a short TTL.
 * Non-clinical roles never trigger a lookup and resolve to null.
 */
export type ProfesionalLookup = (id_usuario: number) => Promise<number | null>;

export const CLINICAL_ACTOR_ROLES = [
  'medico',
  'enfermeria',
  'odontologo',
  'laboratorista',
] as const;

const resolved = new WeakMap<AuthPrincipalDto, number | null>();

function isClinical(principal: AuthPrincipalDto): boolean {
  return principal.roles.some((role) => (CLINICAL_ACTOR_ROLES as readonly string[]).includes(role));
}

function isSuperadmin(principal: AuthPrincipalDto): boolean {
  return principal.roles.includes('superadministrador');
}

export interface ProfesionalResolver {
  /** Resolves and remembers the principal's professional; null for non-clinical users. */
  attach(principal: AuthPrincipalDto): Promise<void>;
}

/**
 * `superadminFallback`: the grading superadministrador has no USUARIO.id_profesional; when acting
 * clinically in the selected institution it is attributed to that institution's first active
 * PROFESIONAL (lowest id in its own engine's catalog). Clinical roles never use the fallback.
 */
export function createProfesionalResolver(
  lookup: ProfesionalLookup | undefined,
  options: {
    ttlMs?: number;
    now?: () => number;
    superadminFallback?: (principal: AuthPrincipalDto) => Promise<number | null>;
  } = {},
): ProfesionalResolver {
  const ttlMs = options.ttlMs ?? 60_000;
  const now = options.now ?? Date.now;
  const cache = new Map<string, { value: number | null; expires: number }>();
  return {
    async attach(principal) {
      const superadmin = isSuperadmin(principal);
      if (!isClinical(principal) && !superadmin) {
        resolved.set(principal, null);
        return;
      }
      const key = `${principal.id_usuario}:${principal.id_institucion}`;
      const hit = cache.get(key);
      if (hit && hit.expires > now()) {
        resolved.set(principal, hit.value);
        return;
      }
      let value: number | null = null;
      try {
        if (lookup) value = await lookup(principal.id_usuario);
        if (value == null && superadmin && options.superadminFallback)
          value = await options.superadminFallback(principal);
      } catch {
        // Store unavailable: no attribution rather than a guessed professional.
        resolved.set(principal, null);
        return;
      }
      cache.set(key, { value, expires: now() + ttlMs });
      resolved.set(principal, value);
    },
  };
}

/** USUARIO.id_profesional of the verified principal (null when none or not clinical). */
export function profesionalOf(principal: AuthPrincipalDto): number | null {
  return resolved.get(principal) ?? null;
}

import { ClinicalError } from '../clinical-error.js';
import { assertPositiveId, assertRoles, isPlainObject } from './specialty-common.js';

export const NOTE_ROLES = ['medico', 'enfermeria'] as const;

export function assertNoteRole(roles: readonly string[]): void {
  assertRoles(roles, NOTE_ROLES);
}

export function parseOp36Body(body: unknown): {
  id_nota_anterior?: number | null;
  contenido: string;
  turno?: string | null;
} {
  if (!isPlainObject(body)) throw new ClinicalError('invalid_body', 'Solicitud inválida');
  if (typeof body.contenido !== 'string' || body.contenido.trim().length === 0 || body.contenido.length > 10000) {
    throw new ClinicalError('invalid_body', 'Solicitud inválida');
  }
  const out: { id_nota_anterior?: number | null; contenido: string; turno?: string | null } = {
    contenido: body.contenido.trim(),
  };
  if ('turno' in body) {
    if (body.turno === null) out.turno = null;
    else if (typeof body.turno === 'string' && ['diurno', 'nocturno'].includes(body.turno)) out.turno = body.turno;
    else throw new ClinicalError('invalid_body', 'Solicitud inválida');
  }
  if ('id_nota_anterior' in body) {
    out.id_nota_anterior =
      body.id_nota_anterior === null ? null : assertPositiveId(body.id_nota_anterior, 'invalid_body');
  }
  return out;
}

export function parseAdmissionIdParam(params: { id: number }): number {
  return assertPositiveId(params.id);
}

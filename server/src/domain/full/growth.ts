import { ClinicalError } from '../clinical-error.js';
import { assertPositiveId, assertRoles, isPlainObject } from './specialty-common.js';

export const GROWTH_ROLES = ['medico', 'enfermeria'] as const;

export function assertGrowthRole(roles: readonly string[]): void {
  assertRoles(roles, GROWTH_ROLES);
}

export function parsePerinatalBody(body: unknown) {
  if (!isPlainObject(body)) throw new ClinicalError('invalid_body', 'Solicitud inválida');
  const out: Record<string, unknown> = {};
  for (const key of [
    'semanas_gestacion',
    'tipo_parto',
    'peso_nacimiento_g',
    'talla_nacimiento_cm',
    'apgar_1min',
    'apgar_5min',
    'complicaciones',
  ]) {
    if (key in body) out[key] = body[key];
  }
  return out as {
    semanas_gestacion?: number | null;
    tipo_parto?: string | null;
    peso_nacimiento_g?: number | null;
    talla_nacimiento_cm?: number | null;
    apgar_1min?: number | null;
    apgar_5min?: number | null;
    complicaciones?: string | null;
  };
}

export function parseMedicionBody(body: unknown) {
  if (!isPlainObject(body)) throw new ClinicalError('invalid_body', 'Solicitud inválida');
  if (typeof body.fecha_medicion !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(body.fecha_medicion)) {
    throw new ClinicalError('invalid_body', 'Solicitud inválida');
  }
  if (typeof body.peso_kg !== 'number' || body.peso_kg <= 0) {
    throw new ClinicalError('invalid_body', 'Solicitud inválida');
  }
  if (typeof body.talla_cm !== 'number' || body.talla_cm <= 0) {
    throw new ClinicalError('invalid_body', 'Solicitud inválida');
  }
  const out: {
    fecha_medicion: string;
    peso_kg: number;
    talla_cm: number;
    perimetro_cefalico_cm?: number;
  } = {
    fecha_medicion: body.fecha_medicion,
    peso_kg: body.peso_kg,
    talla_cm: body.talla_cm,
  };
  if ('perimetro_cefalico_cm' in body) {
    if (typeof body.perimetro_cefalico_cm !== 'number') {
      throw new ClinicalError('invalid_body', 'Solicitud inválida');
    }
    out.perimetro_cefalico_cm = body.perimetro_cefalico_cm;
  }
  return out;
}

export function parseIdParam(params: { id: number }): number {
  return assertPositiveId(params.id);
}

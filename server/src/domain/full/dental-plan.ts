import { ClinicalError } from '../clinical-error.js';
import { assertPositiveId, assertRoles, isPlainObject } from './specialty-common.js';

export function assertDentalPlanRole(roles: readonly string[]): void {
  assertRoles(roles, ['odontologo']);
}

export function parsePlanInput(body: unknown) {
  if (!isPlainObject(body)) throw new ClinicalError('invalid_body', 'Solicitud inválida');
  if (!Array.isArray(body.detalle) || body.detalle.length === 0) {
    throw new ClinicalError('invalid_body', 'Solicitud inválida');
  }
  return {
    id_profesional: assertPositiveId(body.id_profesional, 'invalid_body'),
    detalle: body.detalle.map((line) => {
      if (!isPlainObject(line)) throw new ClinicalError('invalid_body', 'Solicitud inválida');
      return {
        linea: assertPositiveId(line.linea, 'invalid_body'),
        numero_pieza: assertPositiveId(line.numero_pieza, 'invalid_body'),
        codigo_procedimiento: String(line.codigo_procedimiento),
        orden: assertPositiveId(line.orden, 'invalid_body'),
        precio_unitario: String(line.precio_unitario),
      };
    }),
  };
}

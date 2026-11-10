import type { PacientePatch } from '@genki/shared/full/patient';
import type { CONTACTO_EMERGENCIAInput } from '@genki/shared/full/patient';
import { ClinicalError } from '../clinical-error.js';

const OP09_ROLES = new Set(['recepcion', 'medico', 'administrador', 'enfermeria']);
const OP10_ROLES = new Set(['recepcion', 'medico', 'administrador', 'enfermeria']);

const PATCH_ALLOWED = new Set([
  'tipo_documento',
  'numero_documento',
  'primer_nombre',
  'segundo_nombre',
  'primer_apellido',
  'segundo_apellido',
  'fecha_nacimiento',
  'sexo',
  'tipo_sangre',
  'telefono',
  'correo',
  'direccion',
  'id_municipio',
]);

const PATCH_FORBIDDEN = new Set([
  'id_paciente',
  'id_institucion',
  'estado',
  'fecha_registro',
  'responsables',
]);

const PARENTESCO = new Set(['padre', 'madre', 'hijo', 'cónyuge', 'otro']);
const SEXOS = new Set(['M', 'F', 'X']);

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function requiredTrimmed(value: unknown, field: string): string {
  if (typeof value !== 'string') {
    throw new ClinicalError('invalid_body', `Campo ${field} inválido`);
  }
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    throw new ClinicalError('invalid_body', `Campo ${field} requerido`);
  }
  return trimmed;
}

function optionalTrimmed(value: unknown, field: string): string | null | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (value === null) {
    return null;
  }
  if (typeof value !== 'string') {
    throw new ClinicalError('invalid_body', `Campo ${field} inválido`);
  }
  const trimmed = value.trim();
  return trimmed.length === 0 ? null : trimmed;
}

function assertIsoDateNotFuture(value: string, nowIso: string): void {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new ClinicalError('invalid_body', 'fecha_nacimiento inválida');
  }
  const today = nowIso.slice(0, 10);
  if (value > today) {
    throw new ClinicalError('invalid_body', 'fecha_nacimiento no puede ser futura');
  }
}

export function assertPatientOp09Role(roles: readonly string[]): void {
  if (!roles.some((role) => OP09_ROLES.has(role))) {
    throw new ClinicalError('forbidden', 'Rol no autorizado para actualizar paciente');
  }
}

export function assertPatientOp10Role(roles: readonly string[]): void {
  if (!roles.some((role) => OP10_ROLES.has(role))) {
    throw new ClinicalError('forbidden', 'Rol no autorizado para registrar contacto');
  }
}

export function normalizeDocumento(value: string): string {
  return value.trim().toUpperCase();
}

export function parsePacientePatch(body: PacientePatch, nowIso: string): PacientePatch {
  if (!isPlainObject(body)) {
    throw new ClinicalError('invalid_body', 'Cuerpo inválido');
  }
  const keys = Object.keys(body);
  if (keys.length === 0) {
    throw new ClinicalError('invalid_body', 'Debe enviar al menos un campo');
  }
  for (const key of keys) {
    if (PATCH_FORBIDDEN.has(key) || !PATCH_ALLOWED.has(key)) {
      throw new ClinicalError('invalid_body', `Campo no permitido: ${key}`);
    }
  }

  const next: PacientePatch = {};
  if ('tipo_documento' in body) {
    next.tipo_documento = requiredTrimmed(body.tipo_documento, 'tipo_documento');
  }
  if ('numero_documento' in body) {
    next.numero_documento = normalizeDocumento(
      requiredTrimmed(body.numero_documento, 'numero_documento'),
    );
  }
  if ('primer_nombre' in body) {
    next.primer_nombre = requiredTrimmed(body.primer_nombre, 'primer_nombre');
  }
  if ('segundo_nombre' in body) {
    next.segundo_nombre = optionalTrimmed(body.segundo_nombre, 'segundo_nombre') ?? null;
  }
  if ('primer_apellido' in body) {
    next.primer_apellido = requiredTrimmed(body.primer_apellido, 'primer_apellido');
  }
  if ('segundo_apellido' in body) {
    next.segundo_apellido = optionalTrimmed(body.segundo_apellido, 'segundo_apellido') ?? null;
  }
  if ('fecha_nacimiento' in body) {
    const fecha = requiredTrimmed(body.fecha_nacimiento, 'fecha_nacimiento');
    assertIsoDateNotFuture(fecha, nowIso);
    next.fecha_nacimiento = fecha;
  }
  if ('sexo' in body) {
    const sexo = requiredTrimmed(body.sexo, 'sexo');
    if (!SEXOS.has(sexo)) {
      throw new ClinicalError('invalid_body', 'sexo inválido');
    }
    next.sexo = sexo as 'M' | 'F' | 'X';
  }
  if ('tipo_sangre' in body) {
    next.tipo_sangre = optionalTrimmed(body.tipo_sangre, 'tipo_sangre') ?? null;
  }
  if ('telefono' in body) {
    next.telefono = optionalTrimmed(body.telefono, 'telefono') ?? null;
  }
  if ('correo' in body) {
    next.correo = optionalTrimmed(body.correo, 'correo') ?? null;
  }
  if ('direccion' in body) {
    next.direccion = optionalTrimmed(body.direccion, 'direccion') ?? null;
  }
  if ('id_municipio' in body) {
    const value = body.id_municipio;
    if (value !== null && (typeof value !== 'number' || !Number.isInteger(value) || value <= 0)) {
      throw new ClinicalError('invalid_body', 'id_municipio inválido');
    }
    next.id_municipio = value ?? null;
  }
  return next;
}

export function parseContactoInput(body: CONTACTO_EMERGENCIAInput): CONTACTO_EMERGENCIAInput {
  if (!isPlainObject(body)) {
    throw new ClinicalError('invalid_body', 'Cuerpo inválido');
  }
  const allowed = new Set([
    'nombre_completo',
    'parentesco',
    'telefono',
    'telefono_alterno',
    'es_principal',
  ]);
  for (const key of Object.keys(body)) {
    if (!allowed.has(key)) {
      throw new ClinicalError('invalid_body', `Campo no permitido: ${key}`);
    }
  }
  const nombre_completo = requiredTrimmed(body.nombre_completo, 'nombre_completo');
  const parentesco = requiredTrimmed(body.parentesco, 'parentesco');
  if (!PARENTESCO.has(parentesco)) {
    throw new ClinicalError('invalid_body', 'parentesco inválido');
  }
  const telefono = requiredTrimmed(body.telefono, 'telefono');
  if (typeof body.es_principal !== 'boolean') {
    throw new ClinicalError('invalid_body', 'es_principal inválido');
  }
  const telefono_alterno =
    'telefono_alterno' in body
      ? optionalTrimmed(body.telefono_alterno, 'telefono_alterno')
      : undefined;
  return {
    nombre_completo,
    parentesco,
    telefono,
    ...(telefono_alterno !== undefined ? { telefono_alterno } : {}),
    es_principal: body.es_principal,
  };
}

export function contactIdentityKey(nombre_completo: string, telefono: string): string {
  return `${nombre_completo.trim().toLowerCase()}|${telefono.trim()}`;
}

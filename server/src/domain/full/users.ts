import type { UsuarioAdminInput } from '@genki/shared/full/users';
import { ClinicalError } from '../clinical-error.js';
import { assertRoles, isPlainObject } from './specialty-common.js';

export const USERS_ADMIN_ROLES = ['administrador'] as const;
export const USERS_AUDIT_ROLES = ['administrador', 'auditor'] as const;

export const USER_ROLE_ALLOWLIST = [
  'administrador',
  'recepcion',
  'medico',
  'auditor',
  'enfermeria',
  'odontologo',
  'tecnico',
  'secretaria',
  'caja',
  'almacen',
  'rrhh',
  'laboratorista',
] as const;

export type AllowedUserRole = (typeof USER_ROLE_ALLOWLIST)[number];

const ADMIN_KEYS = new Set([
  'action',
  'id',
  'nombre_usuario',
  'correo',
  'id_profesional',
  'rol',
  'estado',
  'vinculo_paciente',
  'vinculo_profesional',
]);

export function assertUsersAdminRole(roles: readonly string[]): void {
  assertRoles(roles, USERS_ADMIN_ROLES);
}

export function assertUsersAuditRole(roles: readonly string[]): void {
  assertRoles(roles, USERS_AUDIT_ROLES);
}

export function assertAssignableRol(rol: string): void {
  if (rol === 'superadministrador' || !(USER_ROLE_ALLOWLIST as readonly string[]).includes(rol)) {
    throw new ClinicalError('invalid_body', 'Solicitud inválida');
  }
}

/** Deactivating or demoting the only active administrator in the institution is refused. */
export function assertLastActiveAdminGuard(input: {
  targetRol: string;
  targetEstado: string;
  nextRol: string;
  nextEstado: string;
  activeAdminCount: number;
}): void {
  const wasActiveAdmin = input.targetRol === 'administrador' && input.targetEstado === 'activo';
  const staysActiveAdmin = input.nextRol === 'administrador' && input.nextEstado === 'activo';
  if (wasActiveAdmin && !staysActiveAdmin && input.activeAdminCount <= 1) {
    throw new ClinicalError('conflict', 'Conflicto de recurso');
  }
}

export function parseUsuarioAdminInput(body: unknown): UsuarioAdminInput {
  if (!isPlainObject(body)) {
    throw new ClinicalError('invalid_body', 'Solicitud inválida');
  }
  for (const key of Object.keys(body)) {
    if (!ADMIN_KEYS.has(key)) {
      throw new ClinicalError('invalid_body', 'Solicitud inválida');
    }
  }
  const action = body.action;
  if (action !== 'create' && action !== 'update' && action !== 'deactivate') {
    throw new ClinicalError('invalid_body', 'Solicitud inválida');
  }
  const out: UsuarioAdminInput = { action };
  if ('id' in body) {
    if (typeof body.id !== 'number' || !Number.isInteger(body.id) || body.id < 1) {
      throw new ClinicalError('invalid_body', 'Solicitud inválida');
    }
    out.id = body.id;
  }
  if ('nombre_usuario' in body) {
    if (typeof body.nombre_usuario !== 'string' || !body.nombre_usuario.trim()) {
      throw new ClinicalError('invalid_body', 'Solicitud inválida');
    }
    const nombre = body.nombre_usuario.trim();
    if (nombre.length > 80) throw new ClinicalError('invalid_body', 'Solicitud inválida');
    out.nombre_usuario = nombre;
  }
  if ('correo' in body) {
    if (typeof body.correo !== 'string' || !body.correo.trim() || body.correo.length > 120) {
      throw new ClinicalError('invalid_body', 'Solicitud inválida');
    }
    out.correo = body.correo.trim().toLowerCase();
  }
  if ('id_profesional' in body) {
    if (
      body.id_profesional !== null &&
      (typeof body.id_profesional !== 'number' || !Number.isInteger(body.id_profesional))
    ) {
      throw new ClinicalError('invalid_body', 'Solicitud inválida');
    }
    out.id_profesional = body.id_profesional as number | null;
  }
  if ('rol' in body) {
    if (typeof body.rol !== 'string') throw new ClinicalError('invalid_body', 'Solicitud inválida');
    assertAssignableRol(body.rol);
    out.rol = body.rol;
  }
  if ('estado' in body) {
    if (body.estado !== 'activo' && body.estado !== 'bloqueado' && body.estado !== 'inactivo') {
      throw new ClinicalError('invalid_body', 'Solicitud inválida');
    }
    out.estado = body.estado;
  }
  if ('vinculo_paciente' in body) {
    const link = body.vinculo_paciente;
    if (
      !isPlainObject(link) ||
      typeof link.id_paciente !== 'number' ||
      !Number.isInteger(link.id_paciente) ||
      link.id_paciente < 1
    ) {
      throw new ClinicalError('invalid_body', 'Solicitud inválida');
    }
    out.vinculo_paciente = { id_paciente: link.id_paciente };
  }
  if ('vinculo_profesional' in body) {
    const link = body.vinculo_profesional;
    if (
      !isPlainObject(link) ||
      typeof link.id_profesional !== 'number' ||
      !Number.isInteger(link.id_profesional) ||
      link.id_profesional < 1
    ) {
      throw new ClinicalError('invalid_body', 'Solicitud inválida');
    }
    out.vinculo_profesional = { id_profesional: link.id_profesional };
  }
  if (action === 'create') {
    if (!out.nombre_usuario || !out.correo || !out.rol) {
      throw new ClinicalError('invalid_body', 'Solicitud inválida');
    }
  }
  if (action === 'update' || action === 'deactivate') {
    if (!out.id) {
      throw new ClinicalError('invalid_body', 'Solicitud inválida');
    }
  }
  if (action === 'update') {
    const changed =
      out.nombre_usuario !== undefined ||
      out.correo !== undefined ||
      out.id_profesional !== undefined ||
      out.rol !== undefined ||
      out.estado !== undefined ||
      out.vinculo_paciente !== undefined ||
      out.vinculo_profesional !== undefined;
    if (!changed) {
      throw new ClinicalError('invalid_body', 'Solicitud inválida');
    }
  }
  return out;
}

const AUDIT_KEYS = new Set([
  'page',
  'page_size',
  'desde',
  'hasta',
  'entidad',
  'id_registro',
  'id_usuario',
]);

const AUDIT_DATE = /^\d{4}-\d{2}-\d{2}$/;
const AUDIT_DATETIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d{1,6})?)?(Z|[+-]\d{2}:\d{2})$/;
const AUDIT_TEXT_MAX = 120;
const AUDIT_PAGE_MAX = 100_000;

/** `desde`/`hasta` accept `YYYY-MM-DD` or an ISO-8601 datetime with zone; anything else is 400. */
function parseAuditInstant(value: unknown): { raw: string; ms: number } {
  if (typeof value !== 'string') throw new ClinicalError('invalid_query', 'Parámetros inválidos');
  const raw = value.trim();
  const dateOnly = AUDIT_DATE.test(raw);
  if (!dateOnly && !AUDIT_DATETIME.test(raw)) {
    throw new ClinicalError('invalid_query', 'Parámetros inválidos');
  }
  const ms = Date.parse(dateOnly ? `${raw}T00:00:00.000Z` : raw);
  if (Number.isNaN(ms)) throw new ClinicalError('invalid_query', 'Parámetros inválidos');
  if (dateOnly && new Date(ms).toISOString().slice(0, 10) !== raw) {
    throw new ClinicalError('invalid_query', 'Parámetros inválidos');
  }
  return { raw, ms };
}

function parseAuditText(value: unknown): string {
  if (typeof value !== 'string' || value.length > AUDIT_TEXT_MAX) {
    throw new ClinicalError('invalid_query', 'Parámetros inválidos');
  }
  return value;
}

export function parseAuditQuery(query: Record<string, unknown>): {
  page: number;
  page_size: number;
  desde?: string;
  hasta?: string;
  entidad?: string;
  id_registro?: string;
  id_usuario?: number;
} {
  if (!isPlainObject(query)) {
    throw new ClinicalError('invalid_query', 'Parámetros inválidos');
  }
  for (const key of Object.keys(query)) {
    if (!AUDIT_KEYS.has(key)) throw new ClinicalError('invalid_query', 'Parámetros inválidos');
  }
  const page = query.page === undefined ? 1 : Number(query.page);
  const page_size = query.page_size === undefined ? 20 : Number(query.page_size);
  if (
    !Number.isInteger(page) ||
    page < 1 ||
    page > AUDIT_PAGE_MAX ||
    !Number.isInteger(page_size) ||
    page_size < 1 ||
    page_size > 50
  ) {
    throw new ClinicalError('invalid_query', 'Parámetros inválidos');
  }
  const out: {
    page: number;
    page_size: number;
    desde?: string;
    hasta?: string;
    entidad?: string;
    id_registro?: string;
    id_usuario?: number;
  } = { page, page_size };
  const desde = query.desde === undefined ? undefined : parseAuditInstant(query.desde);
  const hasta = query.hasta === undefined ? undefined : parseAuditInstant(query.hasta);
  if (desde && hasta && desde.ms > hasta.ms) {
    throw new ClinicalError('invalid_query', 'Parámetros inválidos');
  }
  if (desde) out.desde = desde.raw;
  if (hasta) out.hasta = hasta.raw;
  if (query.entidad !== undefined) out.entidad = parseAuditText(query.entidad);
  if (query.id_registro !== undefined) out.id_registro = parseAuditText(query.id_registro);
  if (query.id_usuario !== undefined) {
    const id = Number(query.id_usuario);
    if (!Number.isInteger(id) || id < 1 || id > 2_147_483_647)
      throw new ClinicalError('invalid_query', 'Parámetros inválidos');
    out.id_usuario = id;
  }
  return out;
}

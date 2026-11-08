/** Full-system DTOs for module `users` (F2/F3). */

export type { JsonValue, Page, PageQuery } from './schema.js';

export type { ROL, PERMISO, ROL_PERMISO, BITACORA } from './schema.js';

import type { Page, PageQuery } from './schema.js';
import type { UsuarioPublico } from './account.js';

export type UsuarioAdminInput = {
  action: 'create' | 'update' | 'deactivate';
  id?: number;
  nombre_usuario?: string;
  correo?: string;
  id_profesional?: number | null;
  rol?: string;
  estado?: 'activo' | 'bloqueado' | 'inactivo';
  vinculo_paciente?: { id_paciente: number };
  vinculo_profesional?: { id_profesional: number };
};
export type UsuarioAdminResult = { usuario: UsuarioPublico; temporal?: string };
export type AuditQuery = PageQuery & {
  desde?: string;
  hasta?: string;
  entidad?: string;
  id_registro?: string;
  id_usuario?: number;
};
export type BitacoraSafe = {
  id_bitacora: string;
  id_usuario: number;
  entidad: string;
  id_registro: string;
  accion: string;
  fecha_hora: string;
  detalle: { campos: string[]; op: number; resultado: string };
};
export type BitacoraPage = Page<BitacoraSafe>;

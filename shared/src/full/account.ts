/** Full-system DTOs for module `account` (F2/F3). */

export type { JsonValue, Page, PageQuery } from './schema.js';

export type { USUARIO } from './schema.js';

export type UsuarioPublico = {
  id_usuario: number;
  id_institucion: number;
  id_profesional: number | null;
  nombre_usuario: string;
  correo: string;
  rol: string;
  estado: string;
};

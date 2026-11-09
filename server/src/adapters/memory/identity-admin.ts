import type { InstitutionKind } from '@genki/shared';
import type { BitacoraSafe } from '@genki/shared/full/users';
import type { IdentityUser } from '../../ports/identity-store.js';
import { MemoryIdentityStore } from './auth.js';

export interface AdminUserRow extends IdentityUser {
  nombre_usuario: string;
  id_profesional: number | null;
  debe_cambiar_contrasena: boolean;
  auth_version: number;
  intentos_fallidos: number;
}

export interface MemoryIdentityAdmin {
  getUser(id: number): AdminUserRow | null;
  getUserByEmail(email: string): AdminUserRow | null;
  getUserByUsername(nombre: string): AdminUserRow | null;
  setPassword(
    id: number,
    hash: string,
    opts: {
      clearDebeCambiar?: boolean;
      debeCambiar?: boolean;
      clearIntentos?: boolean;
      bumpAuthVersion?: boolean;
    },
  ): void;
  revokeAllSessions(id: number, nowIso: string): Promise<void>;
  countActiveAdmins(id_institucion: number): number;
  createUser(row: Omit<AdminUserRow, 'id_usuario'> & { id_usuario?: number }): AdminUserRow;
  updateUser(
    id: number,
    patch: Partial<
      Pick<
        AdminUserRow,
        'nombre_usuario' | 'email' | 'id_profesional' | 'roles' | 'estado' | 'id_institucion'
      >
    >,
  ): AdminUserRow;
  appendBitacora(
    entry: Omit<BitacoraSafe, 'id_bitacora'> & { id_institucion: number; id_bitacora?: string },
  ): BitacoraSafe;
  queryBitacora(input: {
    page: number;
    page_size: number;
    desde?: string;
    hasta?: string;
    entidad?: string;
    id_registro?: string;
    id_usuario?: number;
    id_institucion?: number;
  }): { items: BitacoraSafe[]; page: number; page_size: number; total: number };
  asIdentityStore(): MemoryIdentityStore;
}

export function createMemoryIdentityAdmin(users: IdentityUser[]): MemoryIdentityAdmin {
  const rows: AdminUserRow[] = users.map((u, index) => ({
    ...u,
    nombre_usuario: u.email.split('@')[0] ?? `user${index + 1}`,
    id_profesional: null,
    debe_cambiar_contrasena: false,
    auth_version: 0,
    intentos_fallidos: 0,
  }));
  const store = new MemoryIdentityStore(rows);
  const bitacora: BitacoraSafe[] = [];
  const bitacoraInstitution = new Map<string, number>();
  let nextId = Math.max(0, ...rows.map((r) => r.id_usuario)) + 1;
  let nextBit = 1;

  return {
    asIdentityStore: () => store,
    getUser(id) {
      return rows.find((r) => r.id_usuario === id) ?? null;
    },
    getUserByEmail(email) {
      const normalized = email.trim().toLowerCase();
      return rows.find((r) => r.email.toLowerCase() === normalized) ?? null;
    },
    getUserByUsername(nombre) {
      return rows.find((r) => r.nombre_usuario === nombre) ?? null;
    },
    setPassword(id, hash, opts) {
      const user = rows.find((r) => r.id_usuario === id);
      if (!user) return;
      user.hash_contrasena = hash;
      if (opts.clearDebeCambiar) user.debe_cambiar_contrasena = false;
      if (opts.debeCambiar) user.debe_cambiar_contrasena = true;
      if (opts.clearIntentos) user.intentos_fallidos = 0;
      if (opts.bumpAuthVersion) user.auth_version += 1;
    },
    async revokeAllSessions(id, nowIso) {
      await store.revokeAllForUser(id, nowIso);
    },
    countActiveAdmins(id_institucion) {
      return rows.filter(
        (r) =>
          r.id_institucion === id_institucion &&
          r.estado === 'activo' &&
          r.roles.includes('administrador'),
      ).length;
    },
    createUser(row) {
      const id = row.id_usuario ?? nextId++;
      const created: AdminUserRow = {
        id_usuario: id,
        email: row.email,
        hash_contrasena: row.hash_contrasena,
        id_institucion: row.id_institucion,
        institution_kind: row.institution_kind,
        roles: [...row.roles],
        estado: row.estado,
        nombre_usuario: row.nombre_usuario,
        id_profesional: row.id_profesional,
        debe_cambiar_contrasena: row.debe_cambiar_contrasena,
        auth_version: row.auth_version,
        intentos_fallidos: row.intentos_fallidos,
      };
      rows.push(created);
      return created;
    },
    updateUser(id, patch) {
      const user = rows.find((r) => r.id_usuario === id);
      if (!user) throw new Error('missing user');
      if (patch.nombre_usuario !== undefined) user.nombre_usuario = patch.nombre_usuario;
      if (patch.email !== undefined) user.email = patch.email;
      if (patch.id_profesional !== undefined) user.id_profesional = patch.id_profesional;
      if (patch.roles !== undefined) user.roles = [...patch.roles];
      if (patch.estado !== undefined) user.estado = patch.estado;
      if (patch.id_institucion !== undefined) user.id_institucion = patch.id_institucion;
      return user;
    },
    appendBitacora(entry) {
      const row: BitacoraSafe = {
        id_bitacora: entry.id_bitacora ?? String(nextBit++),
        id_usuario: entry.id_usuario,
        entidad: entry.entidad,
        id_registro: entry.id_registro,
        accion: entry.accion,
        fecha_hora: entry.fecha_hora,
        detalle: {
          campos: [...entry.detalle.campos],
          op: entry.detalle.op,
          resultado: entry.detalle.resultado,
        },
      };
      bitacoraInstitution.set(row.id_bitacora, entry.id_institucion);
      bitacora.push(row);
      return row;
    },
    queryBitacora(input) {
      let items = bitacora.filter(
        (row) =>
          input.id_institucion === undefined ||
          bitacoraInstitution.get(row.id_bitacora) === input.id_institucion,
      );
      if (input.id_usuario !== undefined) {
        items = items.filter((r) => r.id_usuario === input.id_usuario);
      }
      if (input.entidad) items = items.filter((r) => r.entidad === input.entidad);
      if (input.id_registro) items = items.filter((r) => r.id_registro === input.id_registro);
      if (input.desde) items = items.filter((r) => r.fecha_hora >= input.desde!);
      if (input.hasta) items = items.filter((r) => r.fecha_hora <= input.hasta!);
      items.sort(
        (a, b) =>
          a.fecha_hora.localeCompare(b.fecha_hora) || Number(a.id_bitacora) - Number(b.id_bitacora),
      );
      const total = items.length;
      const start = (input.page - 1) * input.page_size;
      return {
        items: items.slice(start, start + input.page_size),
        page: input.page,
        page_size: input.page_size,
        total,
      };
    },
  };
}

export function institutionKindForId(id: number): InstitutionKind {
  if (id === 1) return 'hospital_general';
  if (id === 2) return 'centro_pediatrico';
  if (id === 3) return 'laboratorio_clinico';
  return 'clinica_odontologica';
}

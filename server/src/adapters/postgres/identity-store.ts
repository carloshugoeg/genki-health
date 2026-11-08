import { engineForKind, type DataEngine, type InstitutionKind } from '@genki/shared';
import type pg from 'pg';
import type {
  IdentityStorePort,
  IdentityUser,
  RefreshSession,
} from '../../ports/identity-store.js';
import { toPgTimestamptz } from './mapper.js';

const KIND_BY_TYPE: Readonly<Record<string, InstitutionKind>> = {
  hospital: 'hospital_general',
  pediatrico: 'centro_pediatrico',
  laboratorio: 'laboratorio_clinico',
  odontologica: 'clinica_odontologica',
};

interface UserRow {
  id_usuario: number;
  correo: string;
  hash_contrasena: string;
  id_institucion: number;
  tipo: string;
  motor_datos: DataEngine;
  rol: string;
  estado: IdentityUser['estado'];
}

interface SessionRow {
  id_usuario: number;
  expires_at: Date | string;
  revoked_at: Date | string | null;
  estado: IdentityUser['estado'];
}

function mapUser(row: UserRow, expectedKind?: InstitutionKind): IdentityUser | null {
  const institution_kind = KIND_BY_TYPE[row.tipo];
  if (
    !institution_kind ||
    (expectedKind != null && institution_kind !== expectedKind) ||
    engineForKind(institution_kind) !== row.motor_datos
  ) {
    return null;
  }
  return {
    id_usuario: row.id_usuario,
    email: row.correo,
    hash_contrasena: row.hash_contrasena,
    id_institucion: row.id_institucion,
    institution_kind,
    roles: [row.rol],
    estado: row.estado,
  };
}

export class PostgresIdentityStore implements IdentityStorePort {
  constructor(private readonly pool: pg.Pool) {}

  async findUser(email: string, kind: InstitutionKind): Promise<IdentityUser | null> {
    const result = await this.pool.query<UserRow>(
      `SELECT u.id_usuario, u.correo, u.hash_contrasena, u.id_institucion,
              u.estado, i.tipo, i.motor_datos, r.nombre AS rol
         FROM usuario u
         JOIN institucion i ON i.id_institucion = u.id_institucion
         JOIN rol r ON r.id_rol = u.id_rol
        WHERE lower(u.correo) = lower($1)`,
      [email.trim()],
    );
    return result.rows[0] ? mapUser(result.rows[0], kind) : null;
  }

  async findUserById(id: number): Promise<IdentityUser | null> {
    const result = await this.pool.query<UserRow>(
      `SELECT u.id_usuario, u.correo, u.hash_contrasena, u.id_institucion,
              u.estado, i.tipo, i.motor_datos, r.nombre AS rol
         FROM usuario u
         JOIN institucion i ON i.id_institucion = u.id_institucion
         JOIN rol r ON r.id_rol = u.id_rol
        WHERE u.id_usuario = $1`,
      [id],
    );
    return result.rows[0] ? mapUser(result.rows[0]) : null;
  }

  async insertRefresh(session: RefreshSession): Promise<void> {
    await this.pool.query(
      `INSERT INTO auth_session (jti_hash, id_usuario, expires_at, created_at, revoked_at)
       VALUES ($1, $2, $3::timestamptz, $4::timestamptz, NULL)`,
      [
        session.jti_hash,
        session.id_usuario,
        toPgTimestamptz(session.expires_at),
        toPgTimestamptz(session.created_at),
      ],
    );
  }

  async rotateRefresh(oldHash: string, next: RefreshSession, nowIso: string): Promise<boolean> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN ISOLATION LEVEL READ COMMITTED');
      const current = await client.query<SessionRow>(
        `SELECT s.id_usuario, s.expires_at, s.revoked_at, u.estado
           FROM auth_session s
           JOIN usuario u ON u.id_usuario = s.id_usuario
          WHERE s.jti_hash = $1
          FOR UPDATE OF s`,
        [oldHash],
      );
      const row = current.rows[0];
      const now = toPgTimestamptz(nowIso);
      if (
        !row ||
        row.revoked_at != null ||
        row.estado !== 'activo' ||
        row.id_usuario !== next.id_usuario ||
        new Date(row.expires_at).getTime() <= now.getTime()
      ) {
        await client.query('COMMIT');
        return false;
      }

      await client.query(
        `UPDATE auth_session SET revoked_at = $2::timestamptz WHERE jti_hash = $1`,
        [oldHash, now],
      );
      await client.query(
        `INSERT INTO auth_session (jti_hash, id_usuario, expires_at, created_at, revoked_at)
         VALUES ($1, $2, $3::timestamptz, $4::timestamptz, NULL)`,
        [
          next.jti_hash,
          next.id_usuario,
          toPgTimestamptz(next.expires_at),
          toPgTimestamptz(next.created_at),
        ],
      );
      await client.query('COMMIT');
      return true;
    } catch (error) {
      await client.query('ROLLBACK').catch(() => undefined);
      throw error;
    } finally {
      client.release();
    }
  }

  async revokeRefresh(hash: string, nowIso: string): Promise<void> {
    await this.pool.query(
      `UPDATE auth_session
          SET revoked_at = COALESCE(revoked_at, $2::timestamptz)
        WHERE jti_hash = $1`,
      [hash, toPgTimestamptz(nowIso)],
    );
  }
}

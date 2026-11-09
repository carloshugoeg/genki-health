import { randomBytes } from 'node:crypto';
import * as argon2 from 'argon2';
import type pg from 'pg';
import { ClinicalError } from '../../../domain/clinical-error.js';
import { generateTemporalPassword } from '../../../domain/full/account.js';
import type { OperationContext } from '../../../ports/full/context.js';
import type {
  AccountRepositoryPort,
  Op03Request,
  Op04Request,
} from '../../../ports/full/account.js';
import { toPgTimestamptz } from '../mapper.js';

interface UserAuthRow {
  id_usuario: number;
  hash_contrasena: string;
  estado: string;
}

export function createPostgresAccountRepository(pool: pg.Pool): AccountRepositoryPort {
  return {
    async op01() {
      throw new ClinicalError('misconfigured', 'OP01 mounted on AuthPort');
    },
    async op02() {
      throw new ClinicalError('misconfigured', 'OP02 mounted on AuthPort');
    },
    async op03(input: Op03Request, context: OperationContext): Promise<void> {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const found = await client.query<UserAuthRow>(
          `SELECT id_usuario, hash_contrasena, estado FROM usuario
            WHERE id_usuario = $1 AND id_institucion = $2 FOR UPDATE`,
          [context.id_usuario, context.id_institucion],
        );
        const user = found.rows[0];
        if (!user || user.estado !== 'activo') {
          throw new ClinicalError('invalid_credentials', 'Credenciales inválidas');
        }
        let ok = false;
        try {
          ok = await argon2.verify(user.hash_contrasena, input.body.anterior);
        } catch {
          ok = false;
        }
        if (!ok) {
          throw new ClinicalError('invalid_credentials', 'Credenciales inválidas');
        }
        const hash = await argon2.hash(input.body.nueva, { type: argon2.argon2id });
        await client.query(
          `UPDATE usuario
              SET hash_contrasena = $2,
                  debe_cambiar_contrasena = false,
                  intentos_fallidos = 0,
                  auth_version = auth_version + 1
            WHERE id_usuario = $1`,
          [user.id_usuario, hash],
        );
        await client.query(
          `UPDATE auth_session
              SET revoked_at = COALESCE(revoked_at, $2::timestamptz)
            WHERE id_usuario = $1 AND revoked_at IS NULL`,
          [user.id_usuario, toPgTimestamptz(context.now)],
        );
        await client.query(
          `INSERT INTO bitacora (id_usuario, entidad, id_registro, accion, fecha_hora, detalle, id_institucion)
           VALUES ($1, 'usuario', $2, 'password', $3::timestamptz, $4::jsonb, $5)`,
          [
            context.id_usuario,
            String(user.id_usuario),
            toPgTimestamptz(context.now),
            JSON.stringify({ campos: ['contrasena'], op: 3, resultado: 'ok' }),
            context.id_institucion,
          ],
        );
        await client.query('COMMIT');
      } catch (err) {
        await client.query('ROLLBACK').catch(() => undefined);
        throw err;
      } finally {
        client.release();
      }
    },
    async op04(input: Op04Request, context: OperationContext): Promise<{ temporal: string }> {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const found = await client.query<UserAuthRow>(
          `SELECT id_usuario, hash_contrasena, estado FROM usuario
            WHERE id_usuario = $1 AND id_institucion = $2 FOR UPDATE`,
          [input.params.id, context.id_institucion],
        );
        const user = found.rows[0];
        if (!user) {
          throw new ClinicalError('not_found', 'Recurso no encontrado');
        }
        const temporal = generateTemporalPassword(randomBytes(24));
        const hash = await argon2.hash(temporal, { type: argon2.argon2id });
        await client.query(
          `UPDATE usuario
              SET hash_contrasena = $2,
                  debe_cambiar_contrasena = true,
                  intentos_fallidos = 0,
                  auth_version = auth_version + 1,
                  estado = CASE WHEN estado = 'bloqueado' THEN 'activo' ELSE estado END
            WHERE id_usuario = $1`,
          [user.id_usuario, hash],
        );
        await client.query(
          `UPDATE auth_session
              SET revoked_at = COALESCE(revoked_at, $2::timestamptz)
            WHERE id_usuario = $1 AND revoked_at IS NULL`,
          [user.id_usuario, toPgTimestamptz(context.now)],
        );
        await client.query(
          `INSERT INTO bitacora (id_usuario, entidad, id_registro, accion, fecha_hora, detalle, id_institucion)
           VALUES ($1, 'usuario', $2, 'reset', $3::timestamptz, $4::jsonb, $5)`,
          [
            context.id_usuario,
            String(user.id_usuario),
            toPgTimestamptz(context.now),
            JSON.stringify({ campos: ['debe_cambiar_contrasena'], op: 4, resultado: 'ok' }),
            context.id_institucion,
          ],
        );
        await client.query('COMMIT');
        return { temporal };
      } catch (err) {
        await client.query('ROLLBACK').catch(() => undefined);
        throw err;
      } finally {
        client.release();
      }
    },
  };
}

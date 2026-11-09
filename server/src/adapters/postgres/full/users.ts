import { randomBytes } from 'node:crypto';
import * as argon2 from 'argon2';
import type pg from 'pg';
import type { Page } from '@genki/shared/full/schema';
import type { BitacoraSafe, UsuarioAdminResult } from '@genki/shared/full/users';
import { ClinicalError } from '../../../domain/clinical-error.js';
import { generateTemporalPassword } from '../../../domain/full/account.js';
import { assertLastActiveAdminGuard } from '../../../domain/full/users.js';
import type { OperationContext } from '../../../ports/full/context.js';
import type { Op05Request, Op06Request, UsersRepositoryPort } from '../../../ports/full/users.js';
import { toPgTimestamptz } from '../mapper.js';

interface UsuarioRow {
  id_usuario: number;
  id_institucion: number;
  id_profesional: number | null;
  nombre_usuario: string;
  correo: string;
  estado: string;
  rol: string;
}

function safeDetalle(value: unknown): BitacoraSafe['detalle'] {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return { campos: [], op: 0, resultado: 'ok' };
  }
  const row = value as { campos?: unknown; op?: unknown; resultado?: unknown };
  const campos = Array.isArray(row.campos)
    ? row.campos.filter((item): item is string => typeof item === 'string')
    : [];
  return {
    campos,
    op: typeof row.op === 'number' ? row.op : 0,
    resultado: typeof row.resultado === 'string' ? row.resultado : 'ok',
  };
}

function mapPublic(row: UsuarioRow) {
  return {
    id_usuario: row.id_usuario,
    id_institucion: row.id_institucion,
    id_profesional: row.id_profesional,
    nombre_usuario: row.nombre_usuario,
    correo: row.correo,
    rol: row.rol,
    estado: row.estado,
  };
}

export function createPostgresUsersRepository(pool: pg.Pool): UsersRepositoryPort {
  return {
    async op05(input: Op05Request, context: OperationContext): Promise<UsuarioAdminResult> {
      const body = input.body;
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        if (body.action === 'create') {
          const rol = await client.query<{ id_rol: number }>(
            `SELECT id_rol FROM rol WHERE nombre = $1`,
            [body.rol],
          );
          if (!rol.rows[0]) throw new ClinicalError('invalid_body', 'Solicitud inválida');
          const temporal = generateTemporalPassword(randomBytes(24));
          const hash = await argon2.hash(temporal, { type: argon2.argon2id });
          const inserted = await client.query<UsuarioRow>(
            `INSERT INTO usuario (
               id_institucion, id_profesional, id_rol, nombre_usuario, correo,
               hash_contrasena, estado, intentos_fallidos, debe_cambiar_contrasena, auth_version
             ) VALUES ($1, $2, $3, $4, $5, $6, 'activo', 0, true, 0)
             RETURNING id_usuario, id_institucion, id_profesional, nombre_usuario, correo, estado`,
            [
              context.id_institucion,
              body.vinculo_profesional?.id_profesional ?? body.id_profesional ?? null,
              rol.rows[0].id_rol,
              body.nombre_usuario,
              body.correo,
              hash,
            ],
          );
          const row = inserted.rows[0]!;
          await client.query(
            `INSERT INTO bitacora (id_usuario, entidad, id_registro, accion, fecha_hora, detalle, id_institucion)
             VALUES ($1, 'usuario', $2, 'create', $3::timestamptz, $4::jsonb, $5)`,
            [
              context.id_usuario,
              String(row.id_usuario),
              toPgTimestamptz(context.now),
              JSON.stringify({
                campos: ['correo', 'rol', 'nombre_usuario'],
                op: 5,
                resultado: 'ok',
              }),
              context.id_institucion,
            ],
          );
          await client.query('COMMIT');
          return { usuario: mapPublic({ ...row, rol: body.rol! }), temporal };
        }

        const current = await client.query<UsuarioRow>(
          `SELECT u.id_usuario, u.id_institucion, u.id_profesional, u.nombre_usuario, u.correo,
                  u.estado, r.nombre AS rol
             FROM usuario u JOIN rol r ON r.id_rol = u.id_rol
            WHERE u.id_usuario = $1 AND u.id_institucion = $2 FOR UPDATE OF u`,
          [body.id, context.id_institucion],
        );
        const target = current.rows[0];
        if (!target) throw new ClinicalError('not_found', 'Recurso no encontrado');
        const admins = await client.query<{ n: string }>(
          `SELECT count(*)::text AS n FROM usuario u
             JOIN rol r ON r.id_rol = u.id_rol
            WHERE u.id_institucion = $1 AND u.estado = 'activo' AND r.nombre = 'administrador'`,
          [target.id_institucion],
        );
        assertLastActiveAdminGuard({
          targetRol: target.rol,
          targetEstado: target.estado,
          nextRol: body.action === 'deactivate' ? target.rol : (body.rol ?? target.rol),
          nextEstado: body.action === 'deactivate' ? 'inactivo' : (body.estado ?? target.estado),
          activeAdminCount: Number(admins.rows[0]?.n ?? 0),
        });

        if (body.action === 'deactivate') {
          const updated = await client.query<UsuarioRow>(
            `UPDATE usuario SET estado = 'inactivo' WHERE id_usuario = $1
             RETURNING id_usuario, id_institucion, id_profesional, nombre_usuario, correo, estado`,
            [target.id_usuario],
          );
          await client.query(
            `UPDATE auth_session SET revoked_at = COALESCE(revoked_at, $2::timestamptz)
              WHERE id_usuario = $1 AND revoked_at IS NULL`,
            [target.id_usuario, toPgTimestamptz(context.now)],
          );
          await client.query(
            `INSERT INTO bitacora (id_usuario, entidad, id_registro, accion, fecha_hora, detalle, id_institucion)
             VALUES ($1, 'usuario', $2, 'deactivate', $3::timestamptz, $4::jsonb, $5)`,
            [
              context.id_usuario,
              String(target.id_usuario),
              toPgTimestamptz(context.now),
              JSON.stringify({ campos: ['estado'], op: 5, resultado: 'ok' }),
              context.id_institucion,
            ],
          );
          await client.query('COMMIT');
          return { usuario: mapPublic({ ...updated.rows[0]!, rol: target.rol }) };
        }

        let id_rol: number | undefined;
        if (body.rol) {
          const rol = await client.query<{ id_rol: number }>(
            `SELECT id_rol FROM rol WHERE nombre = $1`,
            [body.rol],
          );
          if (!rol.rows[0]) throw new ClinicalError('invalid_body', 'Solicitud inválida');
          id_rol = rol.rows[0].id_rol;
        }
        const updated = await client.query<UsuarioRow>(
          `UPDATE usuario SET
             nombre_usuario = COALESCE($2, nombre_usuario),
             correo = COALESCE($3, correo),
             id_profesional = COALESCE($4, id_profesional),
             id_rol = COALESCE($5, id_rol),
             estado = COALESCE($6, estado)
           WHERE id_usuario = $1
           RETURNING id_usuario, id_institucion, id_profesional, nombre_usuario, correo, estado`,
          [
            target.id_usuario,
            body.nombre_usuario ?? null,
            body.correo ?? null,
            (body.vinculo_profesional?.id_profesional ?? body.id_profesional) === undefined
              ? null
              : (body.vinculo_profesional?.id_profesional ?? body.id_profesional),
            id_rol ?? null,
            body.estado ?? null,
          ],
        );
        await client.query(
          `INSERT INTO bitacora (id_usuario, entidad, id_registro, accion, fecha_hora, detalle, id_institucion)
           VALUES ($1, 'usuario', $2, 'update', $3::timestamptz, $4::jsonb, $5)`,
          [
            context.id_usuario,
            String(target.id_usuario),
            toPgTimestamptz(context.now),
            JSON.stringify({
              campos: Object.keys(body).filter((k) => k !== 'action' && k !== 'id'),
              op: 5,
              resultado: 'ok',
            }),
            context.id_institucion,
          ],
        );
        await client.query('COMMIT');
        const row = updated.rows[0]!;
        return {
          usuario: mapPublic({
            ...row,
            rol: body.rol ?? target.rol,
          }),
        };
      } catch (err) {
        await client.query('ROLLBACK').catch(() => undefined);
        if (
          typeof err === 'object' &&
          err !== null &&
          'code' in err &&
          (err as { code: string }).code === '23505'
        ) {
          throw new ClinicalError('conflict', 'Conflicto de recurso');
        }
        if (
          typeof err === 'object' &&
          err !== null &&
          'code' in err &&
          (err as { code: string }).code === '23503'
        ) {
          throw new ClinicalError('not_found', 'Recurso no encontrado');
        }
        throw err;
      } finally {
        client.release();
      }
    },

    async op06(input: Op06Request, context: OperationContext): Promise<Page<BitacoraSafe>> {
      const q = input.query;
      const clauses: string[] = [
        '(b.id_institucion = $1 OR (b.id_institucion IS NULL AND u.id_institucion = $1))',
      ];
      const params: unknown[] = [context.id_institucion];
      if (q.id_usuario !== undefined) {
        params.push(q.id_usuario);
        clauses.push(`b.id_usuario = $${params.length}`);
      }
      if (q.entidad) {
        params.push(q.entidad);
        clauses.push(`b.entidad = $${params.length}`);
      }
      if (q.id_registro) {
        params.push(q.id_registro);
        clauses.push(`b.id_registro = $${params.length}`);
      }
      if (q.desde) {
        params.push(q.desde);
        clauses.push(`b.fecha_hora >= $${params.length}::timestamptz`);
      }
      if (q.hasta) {
        params.push(q.hasta);
        clauses.push(`b.fecha_hora <= $${params.length}::timestamptz`);
      }
      const where = `WHERE ${clauses.join(' AND ')}`;
      const from = `FROM bitacora b JOIN usuario u ON u.id_usuario = b.id_usuario ${where}`;
      const total = await pool.query<{ n: string }>(`SELECT count(*)::text AS n ${from}`, params);
      const page = q.page ?? 1;
      const page_size = q.page_size ?? 20;
      params.push(page_size);
      params.push((page - 1) * page_size);
      const rows = await pool.query<{
        id_bitacora: string;
        id_usuario: number;
        entidad: string;
        id_registro: string;
        accion: string;
        fecha_hora: Date | string;
        detalle: BitacoraSafe['detalle'] | null;
      }>(
        `SELECT b.id_bitacora::text, b.id_usuario, b.entidad, b.id_registro, b.accion, b.fecha_hora, b.detalle
           ${from}
           ORDER BY b.fecha_hora ASC, b.id_bitacora ASC
           LIMIT $${params.length - 1} OFFSET $${params.length}`,
        params,
      );
      return {
        items: rows.rows.map((row) => ({
          id_bitacora: row.id_bitacora,
          id_usuario: row.id_usuario,
          entidad: row.entidad,
          id_registro: row.id_registro,
          accion: row.accion,
          fecha_hora:
            typeof row.fecha_hora === 'string'
              ? row.fecha_hora
              : new Date(row.fecha_hora).toISOString(),
          detalle: safeDetalle(row.detalle),
        })),
        page,
        page_size,
        total: Number(total.rows[0]?.n ?? 0),
      };
    },
  };
}

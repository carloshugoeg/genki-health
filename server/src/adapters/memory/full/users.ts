import { randomBytes } from 'node:crypto';
import * as argon2 from 'argon2';
import type { Page } from '@genki/shared/full/schema';
import type { BitacoraSafe, UsuarioAdminResult } from '@genki/shared/full/users';
import { ClinicalError } from '../../../domain/clinical-error.js';
import { generateTemporalPassword } from '../../../domain/full/account.js';
import { assertLastActiveAdminGuard } from '../../../domain/full/users.js';
import type { OperationContext } from '../../../ports/full/context.js';
import type { Op05Request, Op06Request, UsersRepositoryPort } from '../../../ports/full/users.js';
import {
  createMemoryIdentityAdmin,
  institutionKindForId,
  type MemoryIdentityAdmin,
} from '../identity-admin.js';
import { toUsuarioPublico } from './account.js';

export function createMemoryUsersRepository(admin: MemoryIdentityAdmin): UsersRepositoryPort {
  return {
    async profesionalDeUsuario(id_usuario: number): Promise<number | null> {
      const user = admin.getUser(id_usuario);
      return user && user.estado === 'activo' ? user.id_profesional : null;
    },
    async op05(input: Op05Request, context: OperationContext): Promise<UsuarioAdminResult> {
      const body = input.body;
      if (body.action === 'create') {
        const existing = admin.getUserByEmail(body.correo!);
        if (existing || admin.getUserByUsername(body.nombre_usuario!)) {
          throw new ClinicalError('conflict', 'Conflicto de recurso');
        }
        const temporal = generateTemporalPassword(randomBytes(24));
        const hash = await argon2.hash(temporal, { type: argon2.argon2id });
        const id_institucion = context.id_institucion;
        const created = admin.createUser({
          email: body.correo!,
          hash_contrasena: hash,
          id_institucion,
          institution_kind: institutionKindForId(id_institucion),
          roles: [body.rol!],
          estado: 'activo',
          nombre_usuario: body.nombre_usuario!,
          id_profesional: body.vinculo_profesional?.id_profesional ?? body.id_profesional ?? null,
          debe_cambiar_contrasena: true,
          auth_version: 0,
          intentos_fallidos: 0,
        });
        admin.appendBitacora({
          id_usuario: context.id_usuario,
          id_institucion: context.id_institucion,
          entidad: 'usuario',
          id_registro: String(created.id_usuario),
          accion: 'create',
          fecha_hora: context.now,
          detalle: { campos: ['correo', 'rol', 'nombre_usuario'], op: 5, resultado: 'ok' },
        });
        return {
          usuario: toUsuarioPublico({
            id_usuario: created.id_usuario,
            id_institucion: created.id_institucion,
            id_profesional: created.id_profesional,
            nombre_usuario: created.nombre_usuario,
            correo: created.email,
            rol: created.roles[0]!,
            estado: created.estado,
          }),
          temporal,
        };
      }

      const target = admin.getUser(body.id!);
      if (!target || target.id_institucion !== context.id_institucion) {
        throw new ClinicalError('not_found', 'Recurso no encontrado');
      }
      const nextRol =
        body.action === 'deactivate' ? target.roles[0]! : (body.rol ?? target.roles[0]!);
      const nextEstado = body.action === 'deactivate' ? 'inactivo' : (body.estado ?? target.estado);
      assertLastActiveAdminGuard({
        targetRol: target.roles[0] ?? '',
        targetEstado: target.estado,
        nextRol,
        nextEstado,
        activeAdminCount: admin.countActiveAdmins(target.id_institucion),
      });

      if (body.action === 'deactivate') {
        const updated = admin.updateUser(target.id_usuario, { estado: 'inactivo' });
        await admin.revokeAllSessions(target.id_usuario, context.now);
        admin.appendBitacora({
          id_usuario: context.id_usuario,
          id_institucion: context.id_institucion,
          entidad: 'usuario',
          id_registro: String(updated.id_usuario),
          accion: 'deactivate',
          fecha_hora: context.now,
          detalle: { campos: ['estado'], op: 5, resultado: 'ok' },
        });
        return {
          usuario: toUsuarioPublico({
            id_usuario: updated.id_usuario,
            id_institucion: updated.id_institucion,
            id_profesional: updated.id_profesional,
            nombre_usuario: updated.nombre_usuario,
            correo: updated.email,
            rol: updated.roles[0]!,
            estado: updated.estado,
          }),
        };
      }

      if (body.correo && admin.getUserByEmail(body.correo)?.id_usuario !== target.id_usuario) {
        throw new ClinicalError('conflict', 'Conflicto de recurso');
      }
      if (
        body.nombre_usuario &&
        admin.getUserByUsername(body.nombre_usuario)?.id_usuario !== target.id_usuario
      ) {
        throw new ClinicalError('conflict', 'Conflicto de recurso');
      }
      const idProfesional = body.vinculo_profesional?.id_profesional ?? body.id_profesional;
      const updated = admin.updateUser(target.id_usuario, {
        ...(body.nombre_usuario !== undefined ? { nombre_usuario: body.nombre_usuario } : {}),
        ...(body.correo !== undefined ? { email: body.correo } : {}),
        ...(idProfesional !== undefined ? { id_profesional: idProfesional } : {}),
        ...(body.rol !== undefined ? { roles: [body.rol] } : {}),
        ...(body.estado !== undefined ? { estado: body.estado } : {}),
      });
      admin.appendBitacora({
        id_usuario: context.id_usuario,
        id_institucion: context.id_institucion,
        entidad: 'usuario',
        id_registro: String(updated.id_usuario),
        accion: 'update',
        fecha_hora: context.now,
        detalle: {
          campos: Object.keys(body).filter((k) => k !== 'action' && k !== 'id'),
          op: 5,
          resultado: 'ok',
        },
      });
      return {
        usuario: toUsuarioPublico({
          id_usuario: updated.id_usuario,
          id_institucion: updated.id_institucion,
          id_profesional: updated.id_profesional,
          nombre_usuario: updated.nombre_usuario,
          correo: updated.email,
          rol: updated.roles[0]!,
          estado: updated.estado,
        }),
      };
    },

    async op06(input: Op06Request, context: OperationContext): Promise<Page<BitacoraSafe>> {
      const q = input.query;
      return admin.queryBitacora({
        page: q.page ?? 1,
        page_size: q.page_size ?? 20,
        id_institucion: context.id_institucion,
        ...(q.desde !== undefined ? { desde: q.desde } : {}),
        ...(q.hasta !== undefined ? { hasta: q.hasta } : {}),
        ...(q.entidad !== undefined ? { entidad: q.entidad } : {}),
        ...(q.id_registro !== undefined ? { id_registro: q.id_registro } : {}),
        ...(q.id_usuario !== undefined ? { id_usuario: q.id_usuario } : {}),
      });
    },
  };
}

export { createMemoryIdentityAdmin };

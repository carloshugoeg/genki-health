import { randomBytes } from 'node:crypto';
import * as argon2 from 'argon2';
import type { UsuarioPublico } from '@genki/shared/full/account';
import { ClinicalError } from '../../../domain/clinical-error.js';
import { generateTemporalPassword } from '../../../domain/full/account.js';
import type { OperationContext } from '../../../ports/full/context.js';
import type {
  AccountRepositoryPort,
  Op03Request,
  Op04Request,
} from '../../../ports/full/account.js';
import type { MemoryIdentityAdmin } from '../identity-admin.js';

export function createMemoryAccountRepository(admin: MemoryIdentityAdmin): AccountRepositoryPort {
  return {
    async op01() {
      throw new ClinicalError('misconfigured', 'OP01 mounted on AuthPort');
    },
    async op02() {
      throw new ClinicalError('misconfigured', 'OP02 mounted on AuthPort');
    },
    async op03(input: Op03Request, context: OperationContext): Promise<void> {
      const user = admin.getUser(context.id_usuario);
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
      admin.setPassword(user.id_usuario, hash, {
        clearDebeCambiar: true,
        clearIntentos: true,
        bumpAuthVersion: true,
      });
      await admin.revokeAllSessions(user.id_usuario, context.now);
      admin.appendBitacora({
        id_usuario: context.id_usuario,
        id_institucion: context.id_institucion,
        entidad: 'usuario',
        id_registro: String(user.id_usuario),
        accion: 'password',
        fecha_hora: context.now,
        detalle: { campos: ['contrasena'], op: 3, resultado: 'ok' },
      });
    },
    async op04(input: Op04Request, context: OperationContext): Promise<{ temporal: string }> {
      const user = admin.getUser(input.params.id);
      if (!user || user.id_institucion !== context.id_institucion) {
        throw new ClinicalError('not_found', 'Recurso no encontrado');
      }
      const temporal = generateTemporalPassword(randomBytes(24));
      const hash = await argon2.hash(temporal, { type: argon2.argon2id });
      admin.setPassword(user.id_usuario, hash, {
        clearDebeCambiar: false,
        debeCambiar: true,
        clearIntentos: true,
        bumpAuthVersion: true,
      });
      if (user.estado === 'bloqueado') admin.updateUser(user.id_usuario, { estado: 'activo' });
      await admin.revokeAllSessions(user.id_usuario, context.now);
      admin.appendBitacora({
        id_usuario: context.id_usuario,
        id_institucion: context.id_institucion,
        entidad: 'usuario',
        id_registro: String(user.id_usuario),
        accion: 'reset',
        fecha_hora: context.now,
        detalle: { campos: ['debe_cambiar_contrasena'], op: 4, resultado: 'ok' },
      });
      return { temporal };
    },
  };
}

export function toUsuarioPublico(row: {
  id_usuario: number;
  id_institucion: number;
  id_profesional: number | null;
  nombre_usuario: string;
  correo: string;
  rol: string;
  estado: string;
}): UsuarioPublico {
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

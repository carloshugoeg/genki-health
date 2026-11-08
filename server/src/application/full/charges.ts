/** Engine-neutral orchestration for charges OP-68/69. */

import { createHash } from 'node:crypto';
import type {
  CARGO,
  CargoCaja,
  COMANDO_IDEMPOTENTE,
  JsonValue,
  Page,
  SERVICIO_FACTURABLE,
} from '@genki/shared/full/charges';
import { ClinicalError } from '../../domain/clinical-error.js';
import {
  assertCargoInputSchema,
  assertGenerateCargoRole,
  assertListPendingRole,
  assertPageQuerySchema,
  buildCargoFromTariff,
  toCargoCaja,
} from '../../domain/full/charges.js';
import type {
  ChargesRepositoryPort,
  Op68Request,
  Op68Response,
  Op69Request,
  Op69Response,
  Op70Request,
  Op70Response,
  Op71Request,
  Op71Response,
} from '../../ports/full/charges.js';
import type { FullContext, OperationContext } from '../../ports/full/context.js';

export interface ChargesPersistence {
  isUnavailable(): boolean;
  findServicio(idInstitucion: number, codigo: string): SERVICIO_FACTURABLE | null;
  findComando(idInstitucion: number, clave: string): COMANDO_IDEMPOTENTE | null;
  findCargoByClaveEvento(idInstitucion: number, claveEvento: string): CARGO | null;
  insertCargo(idInstitucion: number, claveEvento: string, cargo: CARGO): void;
  insertComando(comando: COMANDO_IDEMPOTENTE): void;
  listCargosByExpediente(idExpediente: number): CARGO[];
}

function hashRequest(body: unknown): string {
  return createHash('sha256').update(JSON.stringify(body)).digest('hex');
}

export async function runOp68(
  context: FullContext,
  input: Op68Request,
  actor: OperationContext,
  store: ChargesPersistence,
): Promise<Op68Response> {
  if (store.isUnavailable()) {
    throw new ClinicalError('store_unavailable', 'Almacén no disponible');
  }
  const body = assertCargoInputSchema(input.body);
  assertGenerateCargoRole(actor.roles, body.origen);

  return context.unitOfWork.runInTransaction(async () => {
    const idemKey = actor.idempotency_key ?? body.clave_evento;
    const requestHash = hashRequest(body);
    const prior = store.findComando(Number(actor.id_institucion), idemKey);
    if (prior) {
      if (prior.operacion !== 'op68') {
        throw new ClinicalError('conflict', 'Clave de idempotencia en conflicto');
      }
      if (prior.hash_request !== requestHash) {
        throw new ClinicalError('conflict', 'Clave de idempotencia reutilizada con otro payload');
      }
      return prior.respuesta as unknown as CARGO;
    }
    if (store.findCargoByClaveEvento(Number(actor.id_institucion), body.clave_evento)) {
      throw new ClinicalError('conflict', 'clave_evento duplicada');
    }

    const paciente = await context.base.pacientes.findById(body.id_paciente as never);
    if (!paciente) {
      throw new ClinicalError('not_found', 'Paciente no encontrado');
    }
    const expediente = await context.base.pacientes.findExpedienteByPaciente(
      body.id_paciente as never,
    );
    if (!expediente || expediente.estado !== 'activo') {
      throw new ClinicalError('not_found', 'Expediente no encontrado');
    }

    const servicio = store.findServicio(Number(actor.id_institucion), body.codigo_servicio);
    if (!servicio) {
      throw new ClinicalError('not_found', 'Servicio no encontrado');
    }

    const id_cargo = await context.ids.nextInt('cargos');
    const cargo = buildCargoFromTariff({
      id_cargo,
      id_expediente: expediente.id_expediente,
      input: body,
      servicio,
      now: actor.now || context.clock.nowIso(),
    });
    store.insertCargo(Number(actor.id_institucion), body.clave_evento, cargo);
    store.insertComando({
      id_institucion: Number(actor.id_institucion),
      clave: idemKey,
      operacion: 'op68',
      hash_request: requestHash,
      respuesta: cargo as unknown as JsonValue,
    });
    return cargo;
  });
}

export async function runOp69(
  context: FullContext,
  input: Op69Request,
  actor: OperationContext,
  store: ChargesPersistence,
): Promise<Op69Response> {
  if (store.isUnavailable()) {
    throw new ClinicalError('store_unavailable', 'Almacén no disponible');
  }
  const query = assertPageQuerySchema(input.query);
  assertListPendingRole(actor.roles);
  if (!Number.isInteger(input.params.id) || input.params.id < 1) {
    throw new ClinicalError('not_found', 'Paciente no encontrado');
  }

  const paciente = await context.base.pacientes.findById(input.params.id as never);
  if (!paciente) {
    throw new ClinicalError('not_found', 'Paciente no encontrado');
  }
  const expediente = await context.base.pacientes.findExpedienteByPaciente(
    input.params.id as never,
  );
  if (!expediente) {
    throw new ClinicalError('not_found', 'Expediente no encontrado');
  }

  const pending = store
    .listCargosByExpediente(expediente.id_expediente)
    .filter((c) => c.estado === 'pendiente')
    .sort((a, b) => a.id_cargo - b.id_cargo);
  const total = pending.length;
  const start = (query.page - 1) * query.page_size;
  const items: CargoCaja[] = pending.slice(start, start + query.page_size).map(toCargoCaja);
  const page: Page<CargoCaja> = {
    items,
    page: query.page,
    page_size: query.page_size,
    total,
  };
  return page;
}

export async function executeOp68(
  context: FullContext,
  input: Op68Request,
  actor: OperationContext,
): Promise<Op68Response> {
  return context.modules.charges.op68(input, actor);
}

export async function executeOp69(
  context: FullContext,
  input: Op69Request,
  actor: OperationContext,
): Promise<Op69Response> {
  return context.modules.charges.op69(input, actor);
}

export function createChargesPort(
  getContext: () => FullContext,
  store: ChargesPersistence,
): ChargesRepositoryPort {
  return {
    op68: (input, actor) => runOp68(getContext(), input, actor, store),
    op69: (input, actor) => runOp69(getContext(), input, actor, store),
    op70: async (_input: Op70Request, _actor: OperationContext): Promise<Op70Response> => {
      throw new ClinicalError('misconfigured', 'OP-70 no implementado en FS-23-C01');
    },
    op71: async (_input: Op71Request, _actor: OperationContext): Promise<Op71Response> => {
      throw new ClinicalError('misconfigured', 'OP-71 no implementado en FS-23-C01');
    },
  };
}

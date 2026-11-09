import type { CARGO, CargoCaja, SERVICIO_FACTURABLE } from '@genki/shared/full/charges';
import type {
  ChargesRepositoryPort,
  EconomicStore,
  EconomicTransaction,
  Op68Request,
  Op69Request,
  Op70Request,
  Op71Request,
} from '../../ports/full/charges.js';
import type { OperationContext } from '../../ports/full/context.js';
import {
  cents,
  ensure,
  idempotent,
  hash,
  money,
  next,
  page,
  patient,
  scoped,
  text,
} from '../../domain/full/charges.js';
import { ClinicalError } from '../../domain/clinical-error.js';
import { assertRoles } from '../../domain/full/specialty-common.js';

export const CHARGES_ACCESS_ROLES = ['administrador', 'recepcion', 'medico', 'rrhh'] as const;

function requireChargesAccess(ctx: OperationContext): void {
  try {
    assertRoles(ctx.roles, CHARGES_ACCESS_ROLES);
  } catch (error) {
    if (error instanceof ClinicalError && error.code === 'forbidden') {
      ensure(false, error.message, 'forbidden');
    }
    throw error;
  }
}

function requireCargoAutorizar(ctx: OperationContext): void {
  if (ctx.permissions.includes('cargo.autorizar')) return;
  try {
    assertRoles(ctx.roles, ['administrador']);
  } catch (error) {
    if (error instanceof ClinicalError && error.code === 'forbidden') {
      ensure(false, 'Requiere cargo.autorizar', 'forbidden');
    }
    throw error;
  }
}

export const caja = (row: CARGO): CargoCaja => ({
  id_cargo: row.id_cargo,
  descripcion: row.descripcion,
  cantidad: String(row.cantidad),
  precio_unitario: row.precio_unitario,
  subtotal: row.subtotal,
  estado: row.estado,
});
export async function generateCharge(
  tx: EconomicTransaction,
  input: Op68Request['body'],
  ctx: OperationContext,
  frozenPrice?: string,
): Promise<CARGO> {
  text(input.clave_evento);
  return idempotent(tx, `charge:${input.clave_evento}`, input, async () => {
    const p = await patient(tx, input.id_paciente);
    const service = await tx.get<SERVICIO_FACTURABLE>('services', input.codigo_servicio);
    ensure(service?.vigente, 'Servicio no vigente');
    const quantity = Number(input.cantidad);
    ensure(
      typeof input.cantidad === 'string' &&
        /^\d+(\.\d{1,2})?$/.test(input.cantidad) &&
        Number.isFinite(quantity) &&
        quantity > 0 &&
        quantity <= 1000000,
      'Cantidad inválida',
    );
    const origins = [
      input.id_consulta,
      input.id_procedimiento,
      input.id_admision,
      input.id_consumo,
      input.id_participacion,
    ].filter((x) => x != null);
    ensure(
      origins.length <= 1 && origins.every((x) => Number.isSafeInteger(x) && Number(x) > 0),
      'Origen único requerido',
    );
    const originKey = {
      consulta: 'id_consulta',
      procedimiento: 'id_procedimiento',
      estancia: 'id_admision',
      insumo: 'id_consumo',
      honorario: 'id_participacion',
    } as const;
    ensure(
      ['manual', 'consulta', 'procedimiento', 'estancia', 'insumo', 'honorario', 'examen'].includes(
        input.origen,
      ),
      'Origen inválido',
    );
    if (input.origen === 'manual' || input.origen === 'examen')
      ensure(origins.length === 0, 'Origen incompatible');
    else
      ensure(origins.length === 1 && input[originKey[input.origen]] != null, 'Origen incompatible');
    if (input.id_consulta || input.id_procedimiento) {
      const act = await tx.act(
        input.id_consulta ? 'consulta' : 'procedimiento',
        (input.id_consulta ?? input.id_procedimiento)!,
      );
      ensure(act?.id_paciente === p.id_paciente, 'Acto ajeno o inexistente');
    }
    let price = frozenPrice ?? service.precio_unitario;
    if (input.id_admision) {
      const admission = await tx.act('estancia', input.id_admision);
      ensure(admission?.id_paciente === p.id_paciente, 'Admisión ajena o inexistente');
    }
    if (input.id_consumo) {
      const consumption = await tx.get<{
        id_paciente: number;
        codigo_servicio: string;
        cantidad: number;
        precio_unitario: string;
      }>('consumptions', input.id_consumo);
      ensure(
        consumption?.id_paciente === p.id_paciente &&
          consumption.codigo_servicio === input.codigo_servicio &&
          consumption.cantidad === quantity,
        'Consumo ajeno o incompatible',
      );
      price = consumption.precio_unitario;
    }
    if (input.id_participacion) {
      const participation = await tx.get<{
        id_consulta?: number;
        id_procedimiento?: number;
        honorario_calculado: string | null;
      }>('participations', input.id_participacion);
      ensure(
        participation?.honorario_calculado != null && quantity === 1,
        'Honorario no calculado',
      );
      const act = await tx.act(
        participation.id_consulta ? 'consulta' : 'procedimiento',
        (participation.id_consulta ?? participation.id_procedimiento)!,
      );
      ensure(
        act?.id_paciente === p.id_paciente && act.codigo_servicio === input.codigo_servicio,
        'Honorario ajeno o incompatible',
      );
      price = participation.honorario_calculado;
    }
    const eventKey = hash(
      origins.length
        ? { origen: input.origen, id: origins[0], servicio: input.codigo_servicio }
        : { clave: input.clave_evento },
    );
    ensure((await tx.get('charge_events', eventKey)) === null, 'El evento ya generó cargo');
    const row: CARGO = {
      id_cargo: await next(tx, 'charge'),
      id_expediente: p.id_expediente,
      codigo_servicio: input.codigo_servicio,
      origen: input.origen,
      ...(input.id_consulta ? { id_consulta: input.id_consulta } : {}),
      ...(input.id_procedimiento ? { id_procedimiento: input.id_procedimiento } : {}),
      ...(input.id_admision ? { id_admision: input.id_admision } : {}),
      ...(input.id_consumo ? { id_consumo: input.id_consumo } : {}),
      ...(input.id_participacion ? { id_participacion: input.id_participacion } : {}),
      descripcion: service.nombre,
      cantidad: quantity,
      precio_unitario: money(cents(price)),
      subtotal: money(Math.round(cents(price) * quantity)),
      fecha_hora: ctx.now,
      estado: 'pendiente',
    };
    await tx.put('charges', row.id_cargo, row);
    await tx.put('charge_events', eventKey, { id_cargo: row.id_cargo });
    return row;
  });
}
export class ChargesService implements ChargesRepositoryPort {
  constructor(protected readonly store: EconomicStore) {}
  op68(input: Op68Request, ctx: OperationContext) {
    requireChargesAccess(ctx);
    return scoped(this.store, ctx, (tx) => generateCharge(tx, input.body, ctx));
  }
  op69(input: Op69Request, ctx: OperationContext) {
    requireChargesAccess(ctx);
    return scoped(this.store, ctx, async (tx) => {
      const p = await patient(tx, input.params.id);
      return page(
        (await tx.list<CARGO>('charges'))
          .filter((x) => x.id_expediente === p.id_expediente && x.estado === 'pendiente')
          .sort((a, b) => a.id_cargo - b.id_cargo)
          .map(caja),
        input.query,
      );
    });
  }
  op70(input: Op70Request, ctx: OperationContext) {
    requireChargesAccess(ctx);
    return scoped(this.store, ctx, async (tx) => {
      requireCargoAutorizar(ctx);
      text(input.body.motivo);
      ensure(['anulado', 'cortesia'].includes(input.body.estado), 'Disposición inválida');
      const row = await tx.get<CARGO>('charges', input.params.id);
      ensure(row?.estado === 'pendiente', 'Cargo no pendiente');
      row.estado = input.body.estado;
      await tx.put('charges', row.id_cargo, row);
      await tx.put('audit', await next(tx, 'audit'), {
        id_cargo: row.id_cargo,
        estado: row.estado,
        motivo: input.body.motivo,
        id_usuario: ctx.id_usuario,
        fecha_hora: ctx.now,
      });
      return caja(row);
    });
  }
  op71(input: Op71Request, ctx: OperationContext) {
    requireChargesAccess(ctx);
    return scoped(this.store, ctx, async (tx) =>
      page(
        (await tx.list<SERVICIO_FACTURABLE>('services'))
          .filter((x) => x.vigente)
          .sort((a, b) => a.codigo_servicio.localeCompare(b.codigo_servicio)),
        input.query,
      ),
    );
  }
}

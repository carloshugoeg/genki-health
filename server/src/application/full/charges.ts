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
  money,
  next,
  page,
  patient,
  scoped,
  text,
} from '../../domain/full/charges.js';

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
      precio_unitario: money(cents(frozenPrice ?? service.precio_unitario)),
      subtotal: money(Math.round(cents(frozenPrice ?? service.precio_unitario) * quantity)),
      fecha_hora: ctx.now,
      estado: 'pendiente',
    };
    await tx.put('charges', row.id_cargo, row);
    return row;
  });
}
export class ChargesService implements ChargesRepositoryPort {
  constructor(protected readonly store: EconomicStore) {}
  op68(input: Op68Request, ctx: OperationContext) {
    return scoped(this.store, ctx, (tx) => generateCharge(tx, input.body, ctx));
  }
  op69(input: Op69Request, ctx: OperationContext) {
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
    return scoped(this.store, ctx, async (tx) => {
      ensure(ctx.permissions.includes('cargo.autorizar'), 'Requiere cargo.autorizar', 'forbidden');
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

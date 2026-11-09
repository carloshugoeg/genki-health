import type { INSUMO, CONSUMO_INSUMO } from '@genki/shared/full/inventory';
import type {
  InventoryRepositoryPort,
  Op66Request,
  Op67Request,
} from '../../ports/full/inventory.js';
import type { EconomicStore } from '../../ports/full/charges.js';
import type { OperationContext } from '../../ports/full/context.js';
import {
  ensure,
  idempotent,
  next,
  page,
  patient,
  scoped,
  text,
} from '../../domain/full/charges.js';
import { lowStock } from '../../domain/full/inventory.js';
import { generateCharge } from './charges.js';
export class InventoryService implements InventoryRepositoryPort {
  constructor(protected readonly store: EconomicStore) {}
  op66(input: Op66Request, ctx: OperationContext) {
    return scoped(this.store, ctx, async (tx) => {
      text(ctx.idempotency_key);
      return idempotent(tx, `consume:${ctx.idempotency_key}`, input, async () => {
        await patient(tx, input.body.id_paciente);
        const b = input.body.consumo;
        const origins = [b.id_consulta, b.id_procedimiento, b.id_admision].filter((v) => v != null);
        ensure(origins.length <= 1, 'Origen de consumo ambiguo');
        if (b.id_consulta || b.id_procedimiento) {
          const act = await tx.act(
            b.id_consulta ? 'consulta' : 'procedimiento',
            (b.id_consulta ?? b.id_procedimiento)!,
          );
          ensure(act?.id_paciente === input.body.id_paciente, 'Acto ajeno o inexistente');
        }
        ensure(Number.isInteger(b.cantidad) && b.cantidad > 0, 'Cantidad debe ser entero positivo');
        ensure(ctx.id_profesional === b.id_profesional_registra, 'Profesional ajeno', 'forbidden');
        ensure(
          (await tx.get<{ activo: boolean }>('professionals', b.id_profesional_registra))?.activo,
          'Profesional inexistente',
        );
        const supply = await tx.get<INSUMO>('supplies', b.id_insumo);
        ensure(supply?.codigo_servicio, 'Insumo sin servicio');
        ensure(
          Number.isInteger(supply.existencia_actual) && supply.existencia_actual! >= b.cantidad,
          'Existencia insuficiente',
        );
        if (supply.requiere_lote) text(b.lote);
        const row: CONSUMO_INSUMO = {
          ...b,
          id_consumo: await next(tx, 'consumption'),
          precio_unitario: supply.precio_unitario,
          fecha_hora: ctx.now,
        };
        supply.existencia_actual! -= b.cantidad;
        await tx.put('supplies', supply.id_insumo, supply);
        await tx.put('consumptions', row.id_consumo, row);
        await generateCharge(
          tx,
          {
            id_paciente: input.body.id_paciente,
            codigo_servicio: supply.codigo_servicio,
            origen: 'insumo',
            id_consumo: row.id_consumo,
            cantidad: String(b.cantidad),
            clave_evento: `consumo:${row.id_consumo}`,
          },
          ctx,
          supply.precio_unitario,
        );
        return row;
      });
    });
  }
  op67(input: Op67Request, ctx: OperationContext) {
    return scoped(this.store, ctx, async (tx) => {
      ensure(
        input.query.bajo_stock === undefined || typeof input.query.bajo_stock === 'boolean',
        'Filtro inválido',
        'invalid_query',
      );
      const threshold = (await tx.get<number>('metadata', 'low_stock_threshold')) ?? 5;
      return page(
        (await tx.list<INSUMO>('supplies'))
          .filter((x) => !input.query.bajo_stock || lowStock(x.existencia_actual ?? 0, threshold))
          .sort((a, b) => a.id_insumo - b.id_insumo)
          .map((x) => ({
            id_insumo: x.id_insumo,
            id_institucion: x.id_institucion,
            codigo: x.codigo,
            nombre: x.nombre,
            tipo: x.tipo,
            unidad_medida: x.unidad_medida,
            precio_unitario: x.precio_unitario,
            codigo_servicio: x.codigo_servicio ?? null,
            requiere_lote: x.requiere_lote,
            controlado: x.controlado,
            existencia_actual: x.existencia_actual ?? 0,
          })),
        input.query,
      );
    });
  }
}

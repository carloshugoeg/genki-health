import type { CARGO, SERVICIO_FACTURABLE } from '@genki/shared/full/charges';
import type { FacturaCompleta } from '@genki/shared/full/invoicing';
import type {
  InvoicingRepositoryPort,
  Op72Request,
  Op73Request,
} from '../../ports/full/invoicing.js';
import type { EconomicStore, EconomicTransaction } from '../../ports/full/charges.js';
import type { OperationContext } from '../../ports/full/context.js';
import { cents, ensure, money, next, patient, scoped, text } from '../../domain/full/charges.js';
import { selection, totals } from '../../domain/full/invoicing.js';
import { caja } from './charges.js';
export async function selected(tx: EconomicTransaction, id: number, ids: number[]) {
  selection(ids);
  const p = await patient(tx, id);
  const rows: CARGO[] = [];
  for (const cargoId of [...ids].sort((a, b) => a - b)) {
    const row = await tx.get<CARGO>('charges', cargoId);
    ensure(
      row?.id_expediente === p.id_expediente && row.estado === 'pendiente',
      'Cargo ajeno o no pendiente',
    );
    rows.push(row);
  }
  return rows;
}
export class InvoicingService implements InvoicingRepositoryPort {
  constructor(protected readonly store: EconomicStore) {}
  op72(input: Op72Request, ctx: OperationContext) {
    return scoped(this.store, ctx, async (tx) => {
      const rows = await selected(tx, input.params.id, input.body.cargo_ids);
      return {
        cargos: rows.map(caja),
        ...totals(rows, await tx.list<SERVICIO_FACTURABLE>('services')),
      };
    });
  }
  op73(input: Op73Request, ctx: OperationContext) {
    return scoped(this.store, ctx, async (tx) => {
      const b = input.body;
      text(b.serie);
      ensure(/^[A-Za-z0-9-]{1,20}$/.test(b.serie), 'Serie inválida');
      text(b.nombre_receptor);
      text(b.nit_receptor);
      const rows = await selected(tx, input.params.id, b.cargo_ids),
        services = await tx.list<SERVICIO_FACTURABLE>('services'),
        preview = totals(rows, services);
      ensure(preview.preview_hash === b.preview_hash, 'Preview obsoleto');
      const discount = cents(b.descuento ?? '0.00'),
        subtotal = cents(preview.subtotal);
      ensure(discount <= subtotal, 'Descuento excede subtotal');
      // Proportional discount allocates the taxable base; integer cent rounding.
      const taxable = rows.reduce(
        (sum, row) =>
          sum +
          (services.find((s) => s.codigo_servicio === row.codigo_servicio)?.afecto_iva
            ? cents(row.subtotal)
            : 0),
        0,
      );
      const denominator = BigInt(subtotal) * 100n;
      const impuesto =
        subtotal === 0
          ? 0
          : Number(
              (BigInt(taxable) * BigInt(subtotal - discount) * 12n + denominator / 2n) /
                denominator,
            );
      const total = subtotal - discount + impuesto,
        coverage = cents(b.cobertura_seguro ?? '0.00');
      ensure(coverage <= total, 'Cobertura excede total');
      const id = await next(tx, 'invoice'),
        number = await next(tx, `serie:${b.serie}`);
      const factura: FacturaCompleta['factura'] = {
        id_factura: id,
        id_institucion: ctx.id_institucion,
        id_paciente: input.params.id,
        serie: b.serie,
        numero: number,
        fecha_emision: ctx.now,
        nombre_receptor: b.nombre_receptor,
        nit_receptor: b.nit_receptor,
        subtotal: preview.subtotal,
        descuento: money(discount),
        impuesto: money(impuesto),
        total: money(total),
        cobertura_seguro: money(coverage),
        saldo_pendiente: money(total - coverage),
        estado: total === coverage ? 'pagada' : 'pendiente',
        id_usuario_emite: ctx.id_usuario,
      };
      const lineas: FacturaCompleta['lineas'] = [];
      for (const row of rows) {
        lineas.push({
          id_factura: id,
          linea: lineas.length + 1,
          codigo_servicio: row.codigo_servicio,
          descripcion: row.descripcion,
          cantidad: row.cantidad,
          precio_unitario: row.precio_unitario,
          subtotal_linea: row.subtotal,
          id_cargo: row.id_cargo,
        });
        row.estado = 'facturado';
        await tx.put('charges', row.id_cargo, row);
      }
      await tx.put('invoices', id, factura);
      for (const line of lineas) await tx.put('invoice_lines', `${id}:${line.linea}`, line);
      return { factura, lineas, pagos: [] };
    });
  }
}

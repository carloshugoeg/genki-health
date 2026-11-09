import type { FacturaCompleta } from '@genki/shared/full/invoicing';
import type { CARGO } from '@genki/shared/full/charges';
import type { PAGO, CierreCaja } from '@genki/shared/full/payments';
import type {
  PaymentsRepositoryPort,
  Op74Request,
  Op75Request,
  Op76Request,
  Op77Request,
} from '../../ports/full/payments.js';
import type { EconomicStore, EconomicTransaction } from '../../ports/full/charges.js';
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
import { closingDay, guatemalaDay } from '../../domain/full/payments.js';
export async function completeInvoice(
  tx: EconomicTransaction,
  id: number,
): Promise<FacturaCompleta> {
  const factura = await tx.get<FacturaCompleta['factura']>('invoices', id);
  ensure(factura, 'Factura inexistente', 'not_found');
  const lineas = (await tx.list<FacturaCompleta['lineas'][number]>('invoice_lines'))
    .filter((l) => l.id_factura === id)
    .sort((a, b) => a.linea - b.linea);
  const pagos = (await tx.list<PAGO>('payments'))
    .filter((p) => p.id_factura === id)
    .sort((a, b) => a.id_pago - b.id_pago);
  return { factura, lineas, pagos };
}
export class PaymentsService implements PaymentsRepositoryPort {
  constructor(protected readonly store: EconomicStore) {}
  op74(input: Op74Request, ctx: OperationContext) {
    return scoped(this.store, ctx, async (tx) => {
      text(ctx.idempotency_key);
      return idempotent(tx, `payment:${ctx.idempotency_key}`, input, async () => {
        const full = await completeInvoice(tx, input.params.id),
          f = full.factura;
        ensure(f.estado !== 'anulada', 'Factura anulada');
        const amount = cents(input.body.monto);
        ensure(amount > 0 && amount <= cents(f.saldo_pendiente), 'Pago excede saldo o no positivo');
        ensure(
          ['efectivo', 'tarjeta', 'transferencia', 'seguro'].includes(input.body.metodo),
          'Método inválido',
        );
        const pago: PAGO = {
          id_pago: await next(tx, 'payment'),
          id_factura: f.id_factura,
          fecha_hora: ctx.now,
          monto: money(amount),
          metodo: input.body.metodo,
          referencia: input.body.referencia ?? null,
          id_usuario_recibe: ctx.id_usuario,
          anulado: false,
        };
        f.saldo_pendiente = money(cents(f.saldo_pendiente) - amount);
        f.estado = cents(f.saldo_pendiente) === 0 ? 'pagada' : 'parcial';
        await tx.put('payments', pago.id_pago, pago);
        await tx.put('invoices', f.id_factura, f);
        full.pagos.push(pago);
        return full;
      });
    });
  }
  op75(input: Op75Request, ctx: OperationContext) {
    return scoped(this.store, ctx, async (tx) => {
      text(input.body.motivo);
      const full = await completeInvoice(tx, input.params.id),
        f = full.factura;
      ensure(f.estado !== 'anulada', 'Factura ya anulada');
      f.estado = 'anulada';
      f.saldo_pendiente = '0.00';
      f.motivo_anulacion = input.body.motivo;
      for (const p of full.pagos) {
        p.anulado = true;
        await tx.put('payments', p.id_pago, p);
      }
      for (const line of full.lineas) {
        const row = await tx.get<CARGO>('charges', line.id_cargo);
        ensure(row, 'Cargo inexistente');
        row.estado = 'anulado';
        await tx.put('charges', row.id_cargo, row);
      }
      await tx.put('invoices', f.id_factura, f);
      await tx.put('audit', await next(tx, 'audit'), {
        id_factura: f.id_factura,
        motivo: input.body.motivo,
        id_usuario: ctx.id_usuario,
        fecha_hora: ctx.now,
        accion: 'anulacion_sin_reembolso',
      });
      return full;
    });
  }
  op76(input: Op76Request, ctx: OperationContext) {
    return scoped(this.store, ctx, async (tx) => {
      await patient(tx, input.params.id);
      const rows = (await tx.list<FacturaCompleta['factura']>('invoices'))
        .filter((f) => f.id_paciente === input.params.id)
        .sort((a, b) => a.id_factura - b.id_factura);
      const facturas: FacturaCompleta[] = [];
      for (const f of page(rows, input.query).items)
        facturas.push(await completeInvoice(tx, f.id_factura));
      const active = rows.filter((f) => f.estado !== 'anulada');
      const total = active.reduce((n, f) => n + cents(f.total), 0),
        saldo = active.reduce((n, f) => n + cents(f.saldo_pendiente), 0);
      const ids = new Set(active.map((f) => f.id_factura));
      const paid = (await tx.list<PAGO>('payments'))
        .filter((p) => ids.has(p.id_factura) && !p.anulado)
        .reduce((n, p) => n + cents(p.monto), 0);
      return { facturas, total: money(total), pagado: money(paid), saldo: money(saldo) };
    });
  }
  op77(input: Op77Request, ctx: OperationContext) {
    return scoped(this.store, ctx, async (tx) => {
      closingDay(input.query.fecha);
      const groups = new Map<string, { metodo: string; monto: string; anulado: string }>();
      for (const p of await tx.list<PAGO>('payments')) {
        if (guatemalaDay(p.fecha_hora) !== input.query.fecha) continue;
        const row = groups.get(p.metodo) ?? { metodo: p.metodo, monto: '0.00', anulado: '0.00' };
        if (p.anulado) row.anulado = money(cents(row.anulado) + cents(p.monto));
        else row.monto = money(cents(row.monto) + cents(p.monto));
        groups.set(p.metodo, row);
      }
      const por_metodo = [...groups.values()].sort((a, b) => a.metodo.localeCompare(b.metodo));
      const result: CierreCaja = {
        fecha: input.query.fecha,
        por_metodo,
        total: money(por_metodo.reduce((n, r) => n + cents(r.monto), 0)),
      };
      return result;
    });
  }
}

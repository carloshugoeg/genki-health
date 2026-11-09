import { expect } from 'vitest';
import type { EconomicStore } from '../../src/ports/full/charges.js';
import type { OperationContext } from '../../src/ports/full/context.js';
import { ChargesService } from '../../src/application/full/charges.js';
import { InvoicingService } from '../../src/application/full/invoicing.js';
import { PaymentsService } from '../../src/application/full/payments.js';
import { InventoryService } from '../../src/application/full/inventory.js';
import { PersonnelService } from '../../src/application/full/personnel.js';
import { HonorariaService } from '../../src/application/full/honoraria.js';
import { seed } from './charges/harness.js';
import type { INSUMO } from '@genki/shared/full/inventory';
import type { SERVICIO_FACTURABLE } from '@genki/shared/full/charges';

export async function economicContract(
  store: EconomicStore,
  ctx: OperationContext,
  readAgain: () => Promise<EconomicStore>,
) {
  await seed(store);
  await seed(store);
  const personnel = new PersonnelService(store),
    charges = new ChargesService(store),
    invoices = new InvoicingService(store),
    payments = new PaymentsService(store),
    inventory = new InventoryService(store),
    honoraria = new HonorariaService(store);
  const pro = await personnel.op61(
    {
      params: {},
      query: {},
      body: {
        action: 'create',
        nombres: 'Persona',
        apellidos: 'Académica',
        id_tipo_personal: 1,
        modalidad_contrato: 'honorarios',
        numero_colegiado: `TEST-${ctx.idempotency_key}`,
        fecha_ingreso: '2026-01-01',
      },
    },
    ctx,
  );
  const clinical = { ...ctx, id_profesional: pro.profesional.id_profesional };
  const tariff = {
    codigo_servicio: 'CONSULTA',
    modalidad: 'porcentaje',
    porcentaje: '25.00',
    vigente_desde: '2026-01-01',
    vigente_hasta: '2027-01-01',
  };
  await personnel.op62(
    { params: { id: pro.profesional.id_profesional }, query: {}, body: tariff },
    ctx,
  );
  await expect(
    personnel.op62(
      { params: { id: pro.profesional.id_profesional }, query: {}, body: tariff },
      ctx,
    ),
  ).rejects.toMatchObject({ code: 'conflict' });
  const event = {
    params: {},
    query: {},
    body: {
      id_paciente: 1,
      codigo_servicio: 'CONSULTA',
      origen: 'manual' as const,
      cantidad: '1',
      clave_evento: `test:${ctx.idempotency_key}`,
    },
  };
  const charge = await charges.op68(event, ctx);
  expect(await charges.op68(event, ctx)).toEqual(charge);
  await expect(
    charges.op68({ ...event, body: { ...event.body, cantidad: '2' } }, ctx),
  ).rejects.toMatchObject({ code: 'conflict' });
  const preview = await invoices.op72(
    { params: { id: 1 }, query: {}, body: { cargo_ids: [charge.id_cargo] } },
    ctx,
  );
  expect(preview.total).toBe('112.00');
  await expect(
    invoices.op72(
      { params: { id: 1 }, query: {}, body: { cargo_ids: [charge.id_cargo, charge.id_cargo] } },
      ctx,
    ),
  ).rejects.toMatchObject({ code: 'conflict' });
  await expect(
    invoices.op73(
      {
        params: { id: 1 },
        query: {},
        body: {
          cargo_ids: [charge.id_cargo],
          serie: 'TEST',
          nombre_receptor: 'Académico',
          nit_receptor: 'CF',
          preview_hash: 'stale',
        },
      },
      ctx,
    ),
  ).rejects.toMatchObject({ code: 'conflict' });
  const bill = await invoices.op73(
    {
      params: { id: 1 },
      query: {},
      body: {
        cargo_ids: [charge.id_cargo],
        serie: `T-${ctx.idempotency_key!.slice(0, 12)}`,
        nombre_receptor: 'Académico',
        nit_receptor: 'CF',
        preview_hash: preview.preview_hash,
      },
    },
    ctx,
  );
  expect(bill.factura.numero).toBe(1);
  const payment = {
    params: { id: bill.factura.id_factura },
    query: {},
    body: { monto: '100.00', metodo: 'efectivo' as const },
  };
  const results = await Promise.allSettled([
    payments.op74(payment, { ...ctx, idempotency_key: `${ctx.idempotency_key}-pay-a` }),
    payments.op74(payment, { ...ctx, idempotency_key: `${ctx.idempotency_key}-pay-b` }),
  ]);
  expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
  const key =
    results[0]!.status === 'fulfilled'
      ? `${ctx.idempotency_key}-pay-a`
      : `${ctx.idempotency_key}-pay-b`;
  await payments.op74(payment, { ...ctx, idempotency_key: key });
  const reopened = await readAgain();
  const account = await new PaymentsService(reopened).op76(
    { params: { id: 1 }, query: {}, body: {} },
    ctx,
  );
  const persisted = account.facturas.find((f) => f.factura.id_factura === bill.factura.id_factura)!;
  expect(persisted.factura.saldo_pendiente).toBe('12.00');
  expect(persisted.pagos).toHaveLength(1);
  await expect(
    charges.op70(
      { params: { id: charge.id_cargo }, query: {}, body: { estado: 'anulado', motivo: 'Prueba' } },
      ctx,
    ),
  ).rejects.toMatchObject({ code: 'conflict' });
  const before = (await inventory.op67({ params: {}, query: {}, body: {} }, ctx)).items.find(
    (x) => x.id_insumo === 1,
  )!;
  const consume = {
    params: {},
    query: {},
    body: {
      id_paciente: 1,
      consumo: {
        id_insumo: 1,
        id_profesional_registra: pro.profesional.id_profesional,
        cantidad: 1,
      },
    },
  };
  const consumed = await inventory.op66(consume, {
    ...clinical,
    idempotency_key: `${ctx.idempotency_key}-consume`,
  });
  await inventory.op66(consume, { ...clinical, idempotency_key: `${ctx.idempotency_key}-consume` });
  expect(
    (await inventory.op67({ params: {}, query: {}, body: {} }, ctx)).items.find(
      (x) => x.id_insumo === 1,
    )!.existencia_actual,
  ).toBe(before.existencia_actual! - 1);
  await expect(
    charges.op68(
      {
        params: {},
        query: {},
        body: {
          id_paciente: 1,
          codigo_servicio: 'INSUMO',
          origen: 'insumo',
          id_consumo: consumed.id_consumo,
          cantidad: '1',
          clave_evento: `different-key-${ctx.idempotency_key}`,
        },
      },
      ctx,
    ),
  ).rejects.toMatchObject({ code: 'conflict' });
  await expect(
    inventory.op66(
      {
        ...consume,
        body: { ...consume.body, consumo: { ...consume.body.consumo, cantidad: 9999 } },
      },
      { ...clinical, idempotency_key: `${ctx.idempotency_key}-bad` },
    ),
  ).rejects.toMatchObject({ code: 'conflict' });
  // Force failure after stock and consumption have been staged: missing charge service must roll everything back.
  await store.transaction(async (tx) => {
    const service = await tx.get<SERVICIO_FACTURABLE>('services', 'INSUMO');
    await tx.put('services', 'INSUMO', { ...service!, vigente: false });
  });
  const stock = await store.transaction((tx) => tx.get<INSUMO>('supplies', 1));
  await expect(
    inventory.op66(consume, { ...clinical, idempotency_key: `${ctx.idempotency_key}-rollback` }),
  ).rejects.toMatchObject({ code: 'conflict' });
  expect(await store.transaction((tx) => tx.get<INSUMO>('supplies', 1))).toEqual(stock);
  await store.transaction(async (tx) => {
    const service = await tx.get<SERVICIO_FACTURABLE>('services', 'INSUMO');
    await tx.put('services', 'INSUMO', { ...service!, vigente: true });
  });
  const participation = await honoraria.op63(
    {
      params: {},
      query: {},
      body: {
        id_profesional: pro.profesional.id_profesional,
        codigo_rol: 'PRINCIPAL',
        id_consulta: 1,
        fecha_hora_inicio: ctx.now,
      },
    },
    clinical,
  );
  const fees = await honoraria.op64({ params: {}, query: {}, body: { id_consulta: 1 } }, clinical);
  expect(
    fees.find((x) => x.id_participacion === participation.id_participacion)!.honorario_calculado,
  ).toBe('25.00');
  expect(
    await honoraria.op64({ params: {}, query: {}, body: { id_consulta: 1 } }, clinical),
  ).toEqual(fees);
  await expect(
    honoraria.op65(
      {
        params: {},
        query: {
          desde: '2026-01-01',
          hasta: '2027-01-01',
          id_profesional: pro.profesional.id_profesional + 1,
        },
        body: {},
      },
      { ...clinical, roles: [], permissions: [] },
    ),
  ).rejects.toMatchObject({ code: 'forbidden' });
  await payments.op75(
    { params: { id: bill.factura.id_factura }, query: {}, body: { motivo: 'Anulación académica' } },
    ctx,
  );
  const closing = await payments.op77(
    { params: {}, query: { fecha: '2026-11-08' }, body: {} },
    ctx,
  );
  expect(closing.por_metodo.find((x) => x.metodo === 'efectivo')!.anulado).not.toBe('0.00');
  await expect(
    charges.op71({ params: {}, query: { page_size: 51 }, body: {} }, ctx),
  ).rejects.toMatchObject({ code: 'invalid_query' });
}

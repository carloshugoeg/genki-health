import Fastify from 'fastify';
import { describe, expect, it } from 'vitest';
import { asInstitutionId } from '@genki/shared';
import { chargesPlugin } from '../../../src/adapters/http/full/charges.js';
import { personnelPlugin } from '../../../src/adapters/http/full/personnel.js';
import { inventoryPlugin } from '../../../src/adapters/http/full/inventory.js';
import { honorariaPlugin } from '../../../src/adapters/http/full/honoraria.js';
import { invoicingPlugin } from '../../../src/adapters/http/full/invoicing.js';
import { paymentsPlugin } from '../../../src/adapters/http/full/payments.js';
import { MemoryEconomicStore } from '../../../src/adapters/memory/full/charges.js';
import { ChargesService } from '../../../src/application/full/charges.js';
import { PersonnelService } from '../../../src/application/full/personnel.js';
import { InventoryService } from '../../../src/application/full/inventory.js';
import { HonorariaService } from '../../../src/application/full/honoraria.js';
import { InvoicingService } from '../../../src/application/full/invoicing.js';
import { PaymentsService } from '../../../src/application/full/payments.js';
// Contract fixtures only; the route plugins never choose an engine or identity provider.
import { seed } from './harness.js';
async function fixture() {
  const app = Fastify();
  const store = new MemoryEconomicStore(1, {
    patient: async (id) => (id === 1 ? { id_paciente: 1, id_expediente: 1 } : null),
    act: async () => null,
  });
  await seed(store);
  const context = async () => ({
    id_institucion: asInstitutionId(1),
    id_usuario: 1,
    id_profesional: null,
    roles: [],
    permissions: [],
    now: '2026-11-09T01:00:00Z',
  });
  await app.register(chargesPlugin, { repository: new ChargesService(store), context });
  await app.register(personnelPlugin, { repository: new PersonnelService(store), context });
  await app.register(inventoryPlugin, { repository: new InventoryService(store), context });
  await app.register(honorariaPlugin, { repository: new HonorariaService(store), context });
  await app.register(invoicingPlugin, { repository: new InvoicingService(store), context });
  await app.register(paymentsPlugin, { repository: new PaymentsService(store), context });
  return app;
}
describe('standalone economic plugins', () => {
  it('validates query/body and keeps projections free of origin FKs', async () => {
    const app = await fixture();
    try {
      expect((await app.inject({ url: '/api/insumos?bajo_stock=false' })).json().total).toBe(1);
      expect((await app.inject({ url: '/api/insumos?bajo_stock=garbage' })).statusCode).toBe(400);
      expect((await app.inject({ url: '/api/tarifario?page_size=51' })).statusCode).toBe(400);
      expect(
        (await app.inject({ method: 'POST', url: '/api/cargos', payload: { id_paciente: 1 } }))
          .statusCode,
      ).toBe(400);
      const response = await app.inject({
        method: 'POST',
        url: '/api/cargos',
        payload: {
          id_paciente: 1,
          codigo_servicio: 'CONSULTA',
          origen: 'manual',
          cantidad: '1',
          clave_evento: 'http',
        },
      });
      expect(response.statusCode).toBe(200);
      const cargo = response.json();
      const pending = (await app.inject({ url: '/api/pacientes/1/cargos' })).json().items[0];
      expect(pending.id_consulta).toBeUndefined();
      expect(pending.id_expediente).toBeUndefined();
      expect(
        (
          await app.inject({
            method: 'POST',
            url: `/api/cargos/${cargo.id_cargo}/disposicion`,
            payload: { estado: 'cortesia', motivo: 'Autorización requerida' },
          })
        ).statusCode,
      ).toBe(403);
      const preview = (
        await app.inject({
          method: 'POST',
          url: '/api/pacientes/1/facturas/preview',
          payload: { cargo_ids: [cargo.id_cargo] },
        })
      ).json();
      const invoice = (
        await app.inject({
          method: 'POST',
          url: '/api/pacientes/1/facturas',
          payload: {
            cargo_ids: [cargo.id_cargo],
            serie: 'A',
            nombre_receptor: 'Académico',
            nit_receptor: 'CF',
            preview_hash: preview.preview_hash,
          },
        })
      ).json();
      expect(
        (
          await app.inject({
            method: 'POST',
            url: `/api/facturas/${invoice.factura.id_factura}/pagos`,
            payload: { monto: '112.00', metodo: 'efectivo' },
          })
        ).statusCode,
      ).toBe(409);
      const payment = {
        method: 'POST' as const,
        url: `/api/facturas/${invoice.factura.id_factura}/pagos`,
        headers: { 'idempotency-key': 'payment-http' },
        payload: { monto: '112.00', metodo: 'efectivo' },
      };
      expect((await app.inject(payment)).json().factura.estado).toBe('pagada');
      expect((await app.inject(payment)).json().pagos).toHaveLength(1);
      expect((await app.inject({ url: '/api/caja/cierre?fecha=2026-11-08' })).json().total).toBe(
        '112.00',
      );
      expect((await app.inject({ url: '/api/caja/cierre?fecha=2026-02-30' })).statusCode).toBe(400);
      expect(
        (await app.inject({ url: '/api/honorarios/liquidacion?desde=2026-01-01&hasta=2027-01-01' }))
          .statusCode,
      ).toBe(403);
    } finally {
      await app.close();
    }
  });
});

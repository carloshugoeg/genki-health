import { EconomicPage, type EconomicClient, type Operation } from '../charges/EconomicPage';
const operations: Operation[] = [
  {
    title: 'Registrar pago',
    method: 'POST',
    path: '/api/facturas/:id/pagos',
    fields: [
      { name: 'id', label: 'Factura', type: 'number' },
      { name: 'monto', label: 'Monto en Q', type: 'decimal' },
      {
        name: 'metodo',
        label: 'Método',
        options: ['efectivo', 'tarjeta', 'transferencia', 'seguro'],
      },
      { name: 'referencia', label: 'Referencia', type: 'text', optional: true },
    ],
  },
  {
    title: 'Anular factura',
    method: 'POST',
    path: '/api/facturas/:id/anulacion',
    fields: [
      { name: 'id', label: 'Factura', type: 'number' },
      { name: 'motivo', label: 'Motivo' },
    ],
    confirm: 'Se anularán factura, cargos y pagos. No se realiza un reembolso.',
  },
  {
    title: 'Estado de cuenta',
    method: 'GET',
    path: '/api/pacientes/:id/cuenta',
    fields: [
      { name: 'id', label: 'Paciente', type: 'number', entity: 'paciente' },
      { name: 'page', label: 'Página', type: 'number', optional: true },
      {
        name: 'page_size',
        label: 'Resultados por página (máximo 50)',
        type: 'number',
        optional: true,
      },
    ],
  },
  {
    title: 'Cierre de caja',
    method: 'GET',
    path: '/api/caja/cierre',
    fields: [{ name: 'fecha', label: 'Día de Guatemala', type: 'date' }],
  },
];
export function PaymentsPage({ client }: { client: EconomicClient }) {
  return <EconomicPage title="Caja y pagos" operations={operations} client={client} />;
}

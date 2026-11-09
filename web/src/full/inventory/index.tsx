import { EconomicPage, type EconomicClient, type Operation } from '../charges/EconomicPage';
const operations: Operation[] = [
  {
    title: 'Registrar consumo',
    method: 'POST',
    path: '/api/consumos',
    fields: [
      { name: 'id_paciente', label: 'Paciente', type: 'number' },
      { name: 'consumo.id_insumo', label: 'Insumo', type: 'number' },
      { name: 'consumo.id_profesional_registra', label: 'Profesional', type: 'number' },
      { name: 'consumo.cantidad', label: 'Cantidad entera', type: 'number' },
      { name: 'consumo.lote', label: 'Lote', type: 'text', optional: true },
      { name: 'consumo.id_consulta', label: 'Consulta', type: 'number', optional: true },
      { name: 'consumo.id_procedimiento', label: 'Procedimiento', type: 'number', optional: true },
      { name: 'consumo.id_admision', label: 'Admisión', type: 'number', optional: true },
    ],
  },
  {
    title: 'Consultar existencias',
    method: 'GET',
    path: '/api/insumos',
    fields: [
      { name: 'page', label: 'Página', type: 'number', optional: true },
      {
        name: 'page_size',
        label: 'Resultados por página (máximo 50)',
        type: 'number',
        optional: true,
      },
      { name: 'bajo_stock', label: 'Solo bajo stock', type: 'checkbox', optional: true },
    ],
  },
];
export function InventoryPage({ client }: { client: EconomicClient }) {
  return <EconomicPage title="Inventario" operations={operations} client={client} />;
}

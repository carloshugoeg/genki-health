import { EconomicPage, type EconomicClient, type Operation } from './EconomicPage';
const operations: Operation[] = [
  {
    title: 'Generar cargo',
    method: 'POST',
    path: '/api/cargos',
    fields: [
      { name: 'id_paciente', label: 'Paciente', type: 'number' },
      { name: 'codigo_servicio', label: 'Servicio' },
      {
        name: 'origen',
        label: 'Origen',
        options: [
          'manual',
          'consulta',
          'procedimiento',
          'estancia',
          'insumo',
          'honorario',
          'examen',
        ],
      },
      { name: 'id_consulta', label: 'Consulta', type: 'number', optional: true },
      { name: 'id_procedimiento', label: 'Procedimiento', type: 'number', optional: true },
      { name: 'id_admision', label: 'Admisión', type: 'number', optional: true },
      { name: 'id_consumo', label: 'Consumo', type: 'number', optional: true },
      { name: 'id_participacion', label: 'Participación', type: 'number', optional: true },
      { name: 'cantidad', label: 'Cantidad', type: 'decimal' },
      { name: 'clave_evento', label: 'Referencia única del evento' },
    ],
  },
  {
    title: 'Cargos pendientes',
    method: 'GET',
    path: '/api/pacientes/:id/cargos',
    fields: [
      { name: 'id', label: 'Paciente', type: 'number' },
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
    title: 'Disposición de cargo',
    method: 'POST',
    path: '/api/cargos/:id/disposicion',
    fields: [
      { name: 'id', label: 'Cargo', type: 'number' },
      { name: 'estado', label: 'Disposición', options: ['anulado', 'cortesia'] },
      { name: 'motivo', label: 'Motivo' },
    ],
    confirm: 'Se registrará la disposición y su motivo.',
  },
  {
    title: 'Tarifario',
    method: 'GET',
    path: '/api/tarifario',
    fields: [
      { name: 'page', label: 'Página', type: 'number', optional: true },
      {
        name: 'page_size',
        label: 'Resultados por página (máximo 50)',
        type: 'number',
        optional: true,
      },
    ],
  },
];
export function ChargesPage({ client }: { client: EconomicClient }) {
  return <EconomicPage title="Cargos y tarifario" operations={operations} client={client} />;
}

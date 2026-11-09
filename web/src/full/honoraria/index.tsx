import { EconomicPage, type EconomicClient, type Operation } from '../charges/EconomicPage';
const operations: Operation[] = [
  {
    title: 'Registrar equipo',
    method: 'POST',
    path: '/api/participaciones',
    fields: [
      { name: 'id_profesional', label: 'Profesional', type: 'number' },
      { name: 'codigo_rol', label: 'Rol clínico' },
      { name: 'id_consulta', label: 'Consulta', type: 'number', optional: true },
      { name: 'id_procedimiento', label: 'Procedimiento', type: 'number', optional: true },
      { name: 'fecha_hora_inicio', label: 'Inicio', type: 'datetime-local' },
      { name: 'fecha_hora_fin', label: 'Fin', type: 'datetime-local', optional: true },
    ],
  },
  {
    title: 'Calcular honorarios',
    method: 'POST',
    path: '/api/actos/honorarios',
    fields: [
      { name: 'id_consulta', label: 'Consulta', type: 'number', optional: true },
      { name: 'id_procedimiento', label: 'Procedimiento', type: 'number', optional: true },
    ],
  },
  {
    title: 'Liquidación',
    method: 'GET',
    path: '/api/honorarios/liquidacion',
    fields: [
      { name: 'desde', label: 'Desde', type: 'date' },
      { name: 'hasta', label: 'Hasta (exclusiva)', type: 'date' },
      { name: 'id_profesional', label: 'Profesional', type: 'number', optional: true },
    ],
  },
];
export function HonorariaPage({ client }: { client: EconomicClient }) {
  return <EconomicPage title="Honorarios" operations={operations} client={client} />;
}

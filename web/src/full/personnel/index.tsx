import { EconomicPage, type EconomicClient, type Operation } from '../charges/EconomicPage';
const operations: Operation[] = [
  {
    title: 'Administrar personal',
    method: 'POST',
    path: '/api/personal',
    fields: [
      { name: 'action', label: 'Acción', options: ['create', 'update', 'deactivate'] },
      {
        name: 'id_profesional',
        label: 'Profesional (actualizar o desactivar)',
        type: 'number',
        optional: true,
        entity: 'profesional',
      },
      { name: 'nombres', label: 'Nombres', type: 'text', optional: true },
      { name: 'apellidos', label: 'Apellidos', type: 'text', optional: true },
      {
        name: 'numero_colegiado',
        nullable: true,
        label: 'Colegiado',
        type: 'text',
        optional: true,
      },
      { name: 'id_tipo_personal', label: 'Categoría', type: 'number', optional: true },
      {
        name: 'modalidad_contrato',
        label: 'Contrato',
        options: ['planilla', 'honorarios', 'externo'],
        type: 'text',
        optional: true,
      },
      { name: 'fecha_ingreso', label: 'Ingreso', type: 'date', optional: true },
    ],
  },
  {
    title: 'Definir tarifa',
    method: 'POST',
    path: '/api/personal/:id/tarifas',
    fields: [
      { name: 'id', label: 'Profesional', type: 'number', entity: 'profesional' },
      { name: 'codigo_servicio', label: 'Servicio' },
      { name: 'modalidad', label: 'Modalidad', options: ['fijo', 'porcentaje'] },
      { name: 'monto_fijo', label: 'Monto fijo Q', type: 'decimal', optional: true },
      { name: 'porcentaje', label: 'Porcentaje', type: 'decimal', optional: true },
      { name: 'vigente_desde', label: 'Desde', type: 'date' },
      { name: 'vigente_hasta', label: 'Hasta (exclusiva)', type: 'date', optional: true },
    ],
  },
];
export function PersonnelPage({ client }: { client: EconomicClient }) {
  return <EconomicPage title="Personal y tarifas" operations={operations} client={client} />;
}

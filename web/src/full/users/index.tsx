import { EconomicPage, type EconomicClient, type Operation } from '../charges/EconomicPage';

const ROLE_OPTIONS = [
  'administrador',
  'recepcion',
  'medico',
  'auditor',
  'enfermeria',
  'odontologo',
  'tecnico',
  'secretaria',
  'caja',
  'almacen',
  'rrhh',
  'laboratorista',
];

const operations: Operation[] = [
  {
    title: 'Administrar usuarios',
    method: 'POST',
    path: '/api/usuarios',
    fields: [
      { name: 'action', label: 'Acción', options: ['create', 'update', 'deactivate'] },
      { name: 'id', label: 'Usuario (actualizar o desactivar)', type: 'number', optional: true },
      { name: 'nombre_usuario', label: 'Nombre de usuario', optional: true },
      { name: 'correo', label: 'Correo', optional: true },
      {
        name: 'id_profesional',
        label: 'Profesional vinculado',
        type: 'number',
        optional: true,
        nullable: true,
        entity: 'profesional',
      },
      { name: 'rol', label: 'Rol', options: ROLE_OPTIONS, optional: true },
      {
        name: 'estado',
        label: 'Estado',
        options: ['activo', 'bloqueado', 'inactivo'],
        optional: true,
      },
    ],
  },
  {
    title: 'Consultar bitácora',
    method: 'GET',
    path: '/api/bitacora',
    fields: [
      { name: 'page', label: 'Página', type: 'number', optional: true },
      {
        name: 'page_size',
        label: 'Resultados por página (máximo 50)',
        type: 'number',
        optional: true,
      },
      { name: 'desde', label: 'Desde (ISO)', optional: true },
      { name: 'hasta', label: 'Hasta (ISO)', optional: true },
      { name: 'entidad', label: 'Entidad', optional: true },
      { name: 'id_registro', label: 'Registro', optional: true },
      { name: 'id_usuario', label: 'Usuario', type: 'number', optional: true },
    ],
  },
];

export function UsersPage({ client }: { client: EconomicClient }) {
  return <EconomicPage title="Usuarios y bitácora" operations={operations} client={client} />;
}

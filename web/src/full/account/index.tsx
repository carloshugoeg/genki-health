import { EconomicPage, type EconomicClient, type Operation } from '../charges/EconomicPage';

const operations: Operation[] = [
  {
    title: 'Cambiar contraseña',
    method: 'POST',
    path: '/api/auth/password',
    fields: [
      { name: 'anterior', label: 'Contraseña actual', type: 'password' },
      { name: 'nueva', label: 'Nueva contraseña (≥12, letra y dígito)', type: 'password' },
    ],
  },
  {
    title: 'Restablecer contraseña de usuario',
    method: 'POST',
    path: '/api/usuarios/:id/reset-password',
    fields: [{ name: 'id', label: 'Usuario', type: 'number' }],
    confirm: 'Se generará una contraseña temporal de un solo uso y se cerrarán sus sesiones.',
  },
];

export function AccountPage({ client }: { client: EconomicClient }) {
  return <EconomicPage title="Cuenta y contraseñas" operations={operations} client={client} />;
}

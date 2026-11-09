import type { ReactNode } from 'react';
import { navigate, type AppRoute } from '../router';

const GROUPS: {
  title: string;
  items: { label: string; path: string; route: AppRoute }[];
}[] = [
  {
    title: 'Pacientes',
    items: [
      { label: 'Inicio', path: '/inicio', route: 'home' },
      { label: 'Pacientes', path: '/pacientes', route: 'patients' },
      { label: 'Registrar', path: '/pacientes/nuevo', route: 'register' },
    ],
  },
  {
    title: 'Agenda',
    items: [{ label: 'Agenda', path: '/agenda', route: 'agenda' }],
  },
  {
    title: 'Especialidad',
    items: [
      { label: 'Procedimientos', path: '/procedimientos', route: 'procedimientos' },
      { label: 'Sesiones dentales', path: '/sesiones-dentales', route: 'sesiones-dentales' },
    ],
  },
  {
    title: 'Caja',
    items: [
      { label: 'Cargos', path: '/economia', route: 'economia' },
      { label: 'Inventario', path: '/inventario', route: 'inventario' },
      { label: 'Honorarios', path: '/honorarios', route: 'honorarios' },
      { label: 'Facturación', path: '/facturacion', route: 'facturacion' },
      { label: 'Caja', path: '/caja', route: 'caja' },
      { label: 'Personal', path: '/personal', route: 'personal' },
    ],
  },
  {
    title: 'Usuarios',
    items: [{ label: 'Usuarios', path: '/usuarios', route: 'usuarios' }],
  },
  {
    title: 'Cuenta',
    items: [{ label: 'Cuenta', path: '/cuenta', route: 'cuenta' }],
  },
];

function isCurrent(item: AppRoute, current: AppRoute): boolean {
  if (item === current) return true;
  return item === 'patients' && (current === 'record' || current === 'consultation');
}

export function AppShell({
  institutionName,
  userLabel,
  superadmin,
  busy,
  current,
  onLogout,
  notice,
  children,
}: {
  institutionName: string;
  userLabel: string;
  superadmin: boolean;
  busy: boolean;
  current: AppRoute;
  onLogout: () => void;
  notice?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="app-shell">
      <aside className="sidepanel">
        <p className="eyebrow">Bases de Datos II</p>
        <h1>Genki Health</h1>
        <nav aria-label="Secciones">
          {GROUPS.map((group) => (
            <div key={group.title}>
              <p className="nav-group">{group.title}</p>
              {group.items.map((item) => (
                <button
                  key={item.path}
                  type="button"
                  aria-current={isCurrent(item.route, current) ? 'page' : undefined}
                  onClick={() => navigate(item.path)}
                >
                  {item.label}
                </button>
              ))}
            </div>
          ))}
        </nav>
        {notice}
      </aside>
      <div className="app-main">
        <header className="topbar">
          <div>
            <strong>{institutionName}</strong>
            <p className="muted">{userLabel}</p>
          </div>
          <div className="topbar-actions">
            {superadmin && (
              <button type="button" onClick={() => navigate('/panel')}>
                Volver al panel
              </button>
            )}
            <button type="button" disabled={busy} onClick={onLogout}>
              Cerrar sesión
            </button>
          </div>
        </header>
        {children}
      </div>
    </div>
  );
}

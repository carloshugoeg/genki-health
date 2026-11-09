import { useEffect, useId, useState, type ReactNode } from 'react';
import { navigate, type AppRoute } from '../router';
import { INSTITUTION_META, InstitutionMark, institutionKindByName } from './InstitutionMark';

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
  const kind = institutionKindByName(institutionName);
  const engine = kind ? INSTITUTION_META[kind].engine : undefined;
  const [navOpen, setNavOpen] = useState(false);
  const navId = useId();
  useEffect(() => {
    setNavOpen(false);
  }, [current]);
  useEffect(() => {
    if (!navOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setNavOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [navOpen]);
  return (
    <div className="app-shell" data-institution={kind}>
      <a className="skip-link" href="#contenido">
        Saltar al contenido
      </a>
      <aside className="sidepanel" data-open={navOpen ? 'true' : undefined}>
        <div className="sidepanel-head">
          <div className="sidepanel-brand">
            <p className="eyebrow">Bases de Datos II</p>
            <h1>Genki Health</h1>
          </div>
          <button
            type="button"
            className="nav-toggle"
            aria-expanded={navOpen}
            aria-controls={navId}
            onClick={() => setNavOpen((open) => !open)}
          >
            <span className="nav-toggle-icon" aria-hidden="true" />
            {navOpen ? 'Cerrar menú' : 'Menú'}
          </button>
        </div>
        <nav id={navId} aria-label="Secciones">
          {GROUPS.map((group) => (
            <div key={group.title} className="nav-section">
              <p className="nav-group">{group.title}</p>
              {group.items.map((item) => (
                <button
                  key={item.path}
                  type="button"
                  aria-current={isCurrent(item.route, current) ? 'page' : undefined}
                  onClick={() => {
                    setNavOpen(false);
                    navigate(item.path);
                  }}
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
          <div className="topbar-identity">
            <InstitutionMark kind={kind} />
            <div>
              <strong>{institutionName}</strong>
              <p className="muted">
                {engine && <span className="engine-tag">{engine}</span>}
                <span className="topbar-user">{userLabel}</span>
              </p>
            </div>
          </div>
          <div className="topbar-actions">
            {superadmin && (
              <button type="button" className="btn-secondary" onClick={() => navigate('/panel')}>
                Volver al panel
              </button>
            )}
            <button type="button" className="btn-ghost" disabled={busy} onClick={onLogout}>
              {busy ? 'Cerrando…' : 'Cerrar sesión'}
            </button>
          </div>
        </header>
        <main id="contenido" className="app-content" tabIndex={-1}>
          {children}
        </main>
      </div>
    </div>
  );
}

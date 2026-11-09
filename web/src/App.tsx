import { useEffect, useState, type ReactNode } from 'react';
import { INSTITUTION_ENGINE_ASSIGNMENTS, type AuthPrincipalDto } from '@genki/shared';
import { api, errorMessage, logout } from './api';
import { loadSession } from './session';
import { navigate, route } from './router';
import { Login } from './screens/Login';
import { Panel } from './screens/Panel';
import { Pacientes } from './screens/Pacientes';
import { RegisterPaciente } from './screens/RegisterPaciente';
import { Historial } from './screens/Historial';
import { Inicio } from './screens/Inicio';
import { Agenda } from './full/agenda/Agenda';
import { ChargesPage } from './full/charges';
import { InventoryPage } from './full/inventory';
import { HonorariaPage } from './full/honoraria';
import { InvoicingPage } from './full/invoicing';
import { PaymentsPage } from './full/payments';
import { PersonnelPage } from './full/personnel';
import { ProcedurePage } from './full/procedure';
import { DentalSessionPage } from './full/dental-session';
import { AccountPage } from './full/account';
import { UsersPage } from './full/users';
import { AppShell } from './components/AppShell';
import type { EconomicClient } from './full/charges/EconomicPage';

function isSuperadmin(principal: AuthPrincipalDto): boolean {
  return principal.roles.includes('superadministrador');
}

function economicClient(): EconomicClient {
  return ((path, init) => {
    const requestInit: RequestInit = {
      method: init.method,
      headers: init.headers,
    };
    if (init.body !== undefined) requestInit.body = init.body;
    return api(path, requestInit);
  }) as EconomicClient;
}

function DevNotice() {
  return (
    <p className="notice">
      Vista de desarrollo: la persistencia depende del servidor conectado. El servidor de esta base
      usa memoria; sus datos y sesiones se pierden al reiniciarlo. No acredita persistencia nativa.
    </p>
  );
}

function Brand({ children }: { children?: ReactNode }) {
  return (
    <header className="brand">
      <p className="eyebrow">Bases de Datos II</p>
      <h1>Genki Health</h1>
      <p className="lede">Historiales clínicos por institución</p>
      {children}
      <DevNotice />
    </header>
  );
}

export function App() {
  const [location, setLocation] = useState(() => window.location.pathname + window.location.search);
  const [principal, setPrincipal] = useState<AuthPrincipalDto | null>(null);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  const [busy, setBusy] = useState(false);
  const path = location.split('?')[0] ?? '';
  const current = route(path);
  const session = loadSession();
  useEffect(() => {
    const update = () => setLocation(window.location.pathname + window.location.search);
    window.addEventListener('popstate', update);
    return () => window.removeEventListener('popstate', update);
  }, []);
  useEffect(() => {
    if (!session.access_token && current !== 'login') navigate('/login', true);
  }, [current, session.access_token]);
  useEffect(() => {
    if (!session.access_token || !principal) return;
    if (current === 'login' || current === 'unknown') {
      navigate(isSuperadmin(principal) ? '/panel' : '/inicio', true);
      return;
    }
    if (current === 'home' && path === '/') {
      navigate(isSuperadmin(principal) ? '/panel' : '/inicio', true);
      return;
    }
    if (current === 'panel' && !isSuperadmin(principal)) navigate('/inicio', true);
  }, [principal, current, path, session.access_token]);
  useEffect(() => {
    if (!session.access_token) {
      setPrincipal(null);
      return;
    }
    let active = true;
    setError('');
    setPrincipal(null);
    void api<AuthPrincipalDto>('/api/auth/me')
      .then((p) => {
        if (active) setPrincipal(p);
      })
      .catch((e) => {
        if (active) setError(errorMessage(e));
      });
    return () => {
      active = false;
    };
  }, [session.institution_kind, !!session.access_token, retry]);
  async function signOut() {
    setBusy(true);
    try {
      await logout();
    } catch {
      /* Session is cleared even when revocation fails. */
    } finally {
      setBusy(false);
    }
  }
  const institution = INSTITUTION_ENGINE_ASSIGNMENTS.find(
    (i) => i.kind === principal?.institution_kind,
  );
  const client = economicClient();
  const screen =
    current === 'home' ? (
      <Inicio />
    ) : current === 'patients' ? (
      <Pacientes search={location.includes('?') ? location.slice(location.indexOf('?')) : ''} />
    ) : current === 'register' ? (
      <RegisterPaciente />
    ) : (current === 'record' || current === 'consultation') && principal ? (
      <Historial
        key={`${principal.id_institucion}:${path.split('/')[2]}`}
        patientId={Number(path.split('/')[2])}
        composing={current === 'consultation'}
        principal={principal}
      />
    ) : current === 'agenda' ? (
      <Agenda request={(requestPath, init) => api(requestPath, init)} />
    ) : current === 'economia' ? (
      <ChargesPage client={client} />
    ) : current === 'inventario' ? (
      <InventoryPage client={client} />
    ) : current === 'honorarios' ? (
      <HonorariaPage client={client} />
    ) : current === 'facturacion' ? (
      <InvoicingPage client={client} />
    ) : current === 'caja' ? (
      <PaymentsPage client={client} />
    ) : current === 'personal' ? (
      <PersonnelPage client={client} />
    ) : current === 'procedimientos' ? (
      <ProcedurePage client={client} />
    ) : current === 'sesiones-dentales' ? (
      <DentalSessionPage client={client} />
    ) : current === 'cuenta' ? (
      <AccountPage client={client} />
    ) : current === 'usuarios' ? (
      <UsersPage client={client} />
    ) : null;

  if (current === 'login' && !session.access_token) {
    return (
      <main className="shell">
        <Brand />
        <Login />
      </main>
    );
  }
  if (!session.access_token) return null;
  if (error) {
    return (
      <main className="shell">
        <Brand>
          <button disabled={busy} onClick={() => void signOut()}>
            Cerrar sesión
          </button>
        </Brand>
        <div role="alert">
          <p className="error">{error}</p>
          <button onClick={() => setRetry((n) => n + 1)}>Reintentar</button>
        </div>
      </main>
    );
  }
  if (!principal) {
    return (
      <main className="shell">
        <Brand>
          <button disabled={busy} onClick={() => void signOut()}>
            Cerrar sesión
          </button>
        </Brand>
        <p role="status">Verificando sesión…</p>
      </main>
    );
  }
  if (current === 'panel' && isSuperadmin(principal)) {
    return (
      <main className="shell">
        <Brand>
          <button disabled={busy} onClick={() => void signOut()}>
            Cerrar sesión
          </button>
        </Brand>
        <Panel />
      </main>
    );
  }
  return (
    <AppShell
      institutionName={institution?.nombre ?? 'Institución'}
      userLabel={principal.email}
      superadmin={isSuperadmin(principal)}
      busy={busy}
      current={current}
      onLogout={() => void signOut()}
      notice={<DevNotice />}
    >
      {screen}
      <details className="out-of-scope">
        <summary>Fuera del alcance de esta entrega</summary>
        <p>Operaciones clínicas especializadas no montadas en este panel.</p>
      </details>
    </AppShell>
  );
}

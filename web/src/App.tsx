import { useEffect, useState } from 'react';
import { INSTITUTION_ENGINE_ASSIGNMENTS, type AuthPrincipalDto } from '@genki/shared';
import { api, errorMessage, logout } from './api';
import { loadSession } from './session';
import { navigate, route } from './router';
import { Login } from './screens/Login';
import { Panel } from './screens/Panel';
import { Pacientes } from './screens/Pacientes';
import { RegisterPaciente } from './screens/RegisterPaciente';
import { Historial } from './screens/Historial';

function isSuperadmin(principal: AuthPrincipalDto): boolean {
  return principal.roles.includes('superadministrador');
}

export function App() {
  const [location, setLocation] = useState(() => window.location.pathname + window.location.search);
  const [principal, setPrincipal] = useState<AuthPrincipalDto | null>(null);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  const [busy, setBusy] = useState(false);
  const current = route(location.split('?')[0]!);
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
      navigate(isSuperadmin(principal) ? '/panel' : '/pacientes', true);
    }
  }, [principal, current, session.access_token]);
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
  return (
    <main className="shell">
      <header className="brand">
        <p className="eyebrow">Bases de Datos II</p>
        <h1>Genki Health</h1>
        <p className="lede">Historiales clínicos por institución</p>
        {principal && (
          <>
            {current !== 'panel' && (
              <p>
                {institution?.nombre} · Motor asignado: {principal.motor}
              </p>
            )}
            <nav className="actions" aria-label="Principal">
              {isSuperadmin(principal) && current !== 'panel' && (
                <button onClick={() => navigate('/panel')}>Volver al panel</button>
              )}
              {current !== 'panel' && (
                <button onClick={() => navigate('/pacientes')}>Pacientes</button>
              )}
              <button disabled={busy} onClick={() => void signOut()}>
                Cerrar sesión
              </button>
            </nav>
          </>
        )}
        {session.access_token && !principal && (
          <button disabled={busy} onClick={() => void signOut()}>
            Cerrar sesión
          </button>
        )}
        <p className="notice">
          Vista de desarrollo: la persistencia depende del servidor conectado. El servidor de esta
          base usa memoria; sus datos y sesiones se pierden al reiniciarlo. No acredita persistencia
          nativa.
        </p>
      </header>
      {current === 'login' && !session.access_token ? (
        <Login />
      ) : !session.access_token ? null : error ? (
        <div role="alert">
          <p className="error">{error}</p>
          <button onClick={() => setRetry((n) => n + 1)}>Reintentar</button>
        </div>
      ) : !principal ? (
        <p role="status">Verificando sesión…</p>
      ) : current === 'panel' && isSuperadmin(principal) ? (
        <Panel />
      ) : current === 'patients' ? (
        <Pacientes search={location.includes('?') ? location.slice(location.indexOf('?')) : ''} />
      ) : current === 'register' ? (
        <RegisterPaciente />
      ) : current === 'record' || current === 'consultation' ? (
        <Historial
          key={`${principal.id_institucion}:${location.split('?')[0]?.split('/')[2]}`}
          patientId={Number(location.split('?')[0]?.split('/')[2])}
          composing={current === 'consultation'}
          principal={principal}
        />
      ) : null}
      <details className="out-of-scope">
        <summary>Fuera del alcance de esta entrega</summary>
        <p>
          Agenda; signos vitales; alergias, antecedentes y adjuntos; hospitalización y notas de
          evolución; crecimiento, vacunas e hitos; laboratorio especializado; odontograma y planes;
          inventario, honorarios, facturación y caja; gestión de usuarios y contraseñas;
          reactivación.
        </p>
      </details>
    </main>
  );
}

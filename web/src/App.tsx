import { useEffect, useState, type FormEvent } from 'react';
import {
  INSTITUTION_ENGINE_ASSIGNMENTS,
  type AuthTokensDto,
  type InstitutionKind,
} from '@genki/shared';
import { clearSession, loadSession, saveSession } from './session';

interface MeResponse {
  email: string;
  institution_kind: InstitutionKind;
  motor: string;
  roles: string[];
}

export function App() {
  const [email, setEmail] = useState('hospital@genki.local');
  const [password, setPassword] = useState('GenkiDev1');
  const [institutionKind, setInstitutionKind] = useState<InstitutionKind>('hospital_general');
  const [error, setError] = useState<string | null>(null);
  const [me, setMe] = useState<MeResponse | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const session = loadSession();
    if (!session.access_token) {
      return;
    }
    void (async () => {
      const response = await fetch('/api/auth/me', {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (!response.ok) {
        clearSession();
        return;
      }
      setMe((await response.json()) as MeResponse);
    })();
  }, []);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          password,
          institution_kind: institutionKind,
        }),
      });
      const body = (await response.json()) as AuthTokensDto & { message?: string };
      if (!response.ok) {
        setError(body.message ?? 'Login failed');
        return;
      }
      saveSession(body, institutionKind);
      const meResponse = await fetch('/api/auth/me', {
        headers: { Authorization: `Bearer ${body.access_token}` },
      });
      setMe((await meResponse.json()) as MeResponse);
    } catch {
      setError('No se pudo contactar la API. ¿Está corriendo el servidor?');
    } finally {
      setBusy(false);
    }
  }

  function onLogout() {
    clearSession();
    setMe(null);
  }

  return (
    <main className="shell">
      <header className="brand">
        <p className="eyebrow">Bases de Datos II</p>
        <h1>Genki Health</h1>
        <p className="lede">
          Historiales clínicos por institución. Login con correo, contraseña e institución (Auth
          locked 2026-10-19).
        </p>
      </header>

      <section className="engines" aria-labelledby="engines-title">
        <h2 id="engines-title">Instituciones y motores</h2>
        <ul>
          {INSTITUTION_ENGINE_ASSIGNMENTS.map((row) => (
            <li key={row.kind}>
              <strong>{row.nombre}</strong> → {row.engine}
            </li>
          ))}
        </ul>
      </section>

      <section className="auth-block" aria-labelledby="auth-title">
        <h2 id="auth-title">Autenticación</h2>
        {me ? (
          <div className="session">
            <p>
              Sesión: <strong>{me.email}</strong> · {me.institution_kind} · motor{' '}
              <strong>{me.motor}</strong>
            </p>
            <p className="muted">Roles: {me.roles.join(', ')}</p>
            <button type="button" onClick={onLogout}>
              Cerrar sesión
            </button>
          </div>
        ) : (
          <form className="login-form" onSubmit={onSubmit}>
            <label>
              Correo
              <input
                type="email"
                autoComplete="username"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
              />
            </label>
            <label>
              Contraseña
              <input
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
                minLength={8}
              />
            </label>
            <label>
              Institución
              <select
                value={institutionKind}
                onChange={(event) => setInstitutionKind(event.target.value as InstitutionKind)}
              >
                {INSTITUTION_ENGINE_ASSIGNMENTS.map((row) => (
                  <option key={row.kind} value={row.kind}>
                    {row.nombre}
                  </option>
                ))}
              </select>
            </label>
            {error ? <p className="error">{error}</p> : null}
            <button type="submit" disabled={busy}>
              {busy ? 'Entrando…' : 'Iniciar sesión'}
            </button>
            <p className="muted">
              Demo: hospital@genki.local / GenkiDev1 (y análogos por institución).
            </p>
          </form>
        )}
      </section>
    </main>
  );
}

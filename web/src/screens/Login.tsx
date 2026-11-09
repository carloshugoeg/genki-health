import { useState, type FormEvent } from 'react';
import { INSTITUTION_ENGINE_ASSIGNMENTS, type InstitutionKind } from '@genki/shared';
import { errorMessage, login } from '../api';
import { navigate } from '../router';
import { INSTITUTION_META, InstitutionMark } from '../components/InstitutionMark';
export function Login() {
  const [institution, setInstitution] = useState<InstitutionKind>(
    INSTITUTION_ENGINE_ASSIGNMENTS[0]!.kind,
  );
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError('');
    const data = new FormData(event.currentTarget);
    try {
      await login({
        email: String(data.get('email')),
        password: String(data.get('password')),
        institution_kind: String(data.get('institution')) as InstitutionKind,
      });
      navigate('/');
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="login-screen" data-institution={institution}>
      <div className="login-institutions">
        <h2 id="login-inst-title">Cuatro instituciones, cuatro motores</h2>
        <p className="muted">
          Cada institución guarda sus expedientes en su propia base de datos. Elija una para entrar.
        </p>
        <ul aria-labelledby="login-inst-title">
          {INSTITUTION_ENGINE_ASSIGNMENTS.map((i) => (
            <li key={i.kind}>
              <button
                type="button"
                className="inst-option"
                data-institution={i.kind}
                aria-pressed={institution === i.kind}
                onClick={() => setInstitution(i.kind)}
              >
                <InstitutionMark kind={i.kind} />
                <span>
                  <strong>{i.nombre}</strong>
                  <span className="inst-option-engine">{INSTITUTION_META[i.kind].engine}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      </div>
      <div className="login-card">
        <h2>Iniciar sesión</h2>
        <form className="login-form" onSubmit={submit}>
          <label>
            Correo
            <input
              name="email"
              data-testid="login-email"
              type="email"
              autoComplete="username"
              required
              maxLength={120}
            />
          </label>
          <label>
            Contraseña
            <input
              name="password"
              data-testid="login-password"
              type="password"
              autoComplete="current-password"
              required
              maxLength={200}
            />
          </label>
          <label>
            Institución
            <select
              name="institution"
              data-testid="login-institution"
              value={institution}
              onChange={(event) => setInstitution(event.target.value as InstitutionKind)}
            >
              {INSTITUTION_ENGINE_ASSIGNMENTS.map((i) => (
                <option key={i.kind} value={i.kind}>
                  {i.nombre} ({INSTITUTION_META[i.kind].engine})
                </option>
              ))}
            </select>
          </label>
          {error && (
            <p role="alert" className="error">
              {error}
            </p>
          )}
          <button data-testid="login-submit" disabled={busy}>
            {busy ? 'Entrando…' : 'Iniciar sesión'}
          </button>
        </form>
      </div>
    </section>
  );
}

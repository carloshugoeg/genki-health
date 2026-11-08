import { useState, type FormEvent } from 'react';
import { INSTITUTION_ENGINE_ASSIGNMENTS, type InstitutionKind } from '@genki/shared';
import { errorMessage, login } from '../api';
import { navigate } from '../router';
export function Login() {
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
      navigate('/pacientes');
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <section>
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
          <select name="institution" data-testid="login-institution">
            {INSTITUTION_ENGINE_ASSIGNMENTS.map((i) => (
              <option key={i.kind} value={i.kind}>
                {i.nombre}
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
    </section>
  );
}

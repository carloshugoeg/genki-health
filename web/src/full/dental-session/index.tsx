import { useState, type FormEvent } from 'react';
import type { EconomicClient } from '../charges/EconomicPage';

export function DentalSessionPage({ client }: { client: EconomicClient }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<unknown>();

  async function registerSession(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const planId = Number(data.get('id_plan'));
    const lineas = String(data.get('lineas'))
      .split(',')
      .map((x) => Number(x.trim()))
      .filter((n) => n > 0);
    setBusy(true);
    setError('');
    try {
      const out = await client(`/api/planes/${planId}/sesiones`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'idempotency-key': `ui-sesion-${Date.now()}`,
        },
        body: JSON.stringify({
          fecha: String(data.get('fecha')),
          lineas,
          expected_revision: Number(data.get('expected_revision')),
          anestesia_utilizada: String(data.get('anestesia') || '') || undefined,
          observaciones: String(data.get('observaciones') || '') || undefined,
        }),
      });
      setResult(out);
    } catch (e) {
      setResult(undefined);
      setError(e instanceof Error ? e.message : 'Error');
    } finally {
      setBusy(false);
    }
  }

  async function loadBalance(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const patientId = Number(data.get('id_paciente'));
    setBusy(true);
    setError('');
    try {
      const out = await client(`/api/pacientes/${patientId}/saldo-dental`, {
        method: 'GET',
        headers: {},
      });
      setResult(out);
    } catch (e) {
      setResult(undefined);
      setError(e instanceof Error ? e.message : 'Error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section>
      <h2>Sesiones dentales (FS-19)</h2>
      <p>Odontología · registrar sesión y consultar saldo.</p>
      <form onSubmit={(e) => void registerSession(e)}>
        <h3>Registrar sesión</h3>
        <label>
          Plan
          <input name="id_plan" type="number" required />
        </label>
        <label>
          Fecha
          <input name="fecha" type="date" required />
        </label>
        <label>
          Líneas (csv)
          <input name="lineas" required placeholder="1,2" />
        </label>
        <label>
          Revisión esperada
          <input name="expected_revision" type="number" required defaultValue={0} />
        </label>
        <label>
          Anestesia
          <input name="anestesia" />
        </label>
        <label>
          Observaciones
          <input name="observaciones" />
        </label>
        <button disabled={busy}>{busy ? 'Guardando…' : 'Registrar sesión'}</button>
      </form>
      <form onSubmit={(e) => void loadBalance(e)}>
        <h3>Saldo dental</h3>
        <label>
          Paciente
          <input name="id_paciente" type="number" required />
        </label>
        <button disabled={busy}>Consultar saldo</button>
      </form>
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      {result != null && (
        <pre>
          <code>{JSON.stringify(result, null, 2)}</code>
        </pre>
      )}
    </section>
  );
}

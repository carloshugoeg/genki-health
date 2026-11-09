import { useState, type FormEvent } from 'react';
import type { EconomicClient } from '../charges/EconomicPage';

export function ProcedurePage({ client }: { client: EconomicClient }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<unknown>();

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const idAdmision = String(data.get('id_admision') || '').trim();
    const idConsulta = String(data.get('id_consulta') || '').trim();
    setBusy(true);
    setError('');
    try {
      const body: Record<string, unknown> = {
        codigo_procedimiento: String(data.get('codigo_procedimiento')),
        id_profesional: Number(data.get('id_profesional')),
        fecha_hora: new Date(String(data.get('fecha_hora'))).toISOString(),
        equipo: [],
        consumos: [],
      };
      if (idAdmision) body.id_admision = Number(idAdmision);
      if (idConsulta) body.id_consulta = Number(idConsulta);
      const sala = String(data.get('sala') || '').trim();
      if (sala) body.sala = sala;
      const out = await client('/api/procedimientos', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'idempotency-key': `ui-proc-${Date.now()}`,
        },
        body: JSON.stringify(body),
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
      <h2>Procedimientos (OP37)</h2>
      <p>Hospital · anclar a admisión o consulta (exactamente uno).</p>
      <form onSubmit={(e) => void submit(e)}>
        <label>
          Admisión
          <input name="id_admision" type="number" />
        </label>
        <label>
          Consulta
          <input name="id_consulta" type="number" />
        </label>
        <label>
          Código
          <input name="codigo_procedimiento" required defaultValue="PROC-DEMO" />
        </label>
        <label>
          Profesional
          <input name="id_profesional" type="number" required defaultValue={1} />
        </label>
        <label>
          Fecha/hora
          <input name="fecha_hora" type="datetime-local" required />
        </label>
        <label>
          Sala
          <input name="sala" />
        </label>
        <button disabled={busy}>{busy ? 'Guardando…' : 'Registrar'}</button>
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

import { useEffect, useState } from 'react';
import { api, errorMessage } from '../api';

type Ficha = {
  alergias: Array<{ id_alergia: number; sustancia: string; severidad: string }>;
  antecedentes: Array<{ id_antecedente: number; tipo: string; descripcion: string }>;
};

export function FichaLane1({ patientId }: { patientId: number }) {
  const [ficha, setFicha] = useState<Ficha | null>(null);
  const [error, setError] = useState('');
  const [sustancia, setSustancia] = useState('');
  const [busy, setBusy] = useState(false);

  async function load() {
    setError('');
    try {
      const data = await api<Ficha>(`/api/pacientes/${patientId}/ficha`);
      setFicha(data);
    } catch (e) {
      setError(errorMessage(e));
    }
  }

  useEffect(() => {
    void load();
  }, [patientId]);

  async function addAllergy() {
    setBusy(true);
    setError('');
    try {
      await api(`/api/pacientes/${patientId}/alergias`, {
        method: 'POST',
        headers: { 'Idempotency-Key': `alergia-${patientId}-${Date.now()}` },
        body: JSON.stringify({
          sustancia,
          tipo: 'medicamento',
          severidad: 'leve',
        }),
      });
      setSustancia('');
      await load();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section>
      <h3>Ficha clínica (alergias y antecedentes)</h3>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {!ficha ? (
        <p role="status">Cargando ficha…</p>
      ) : (
        <>
          <p>
            Alergias: {ficha.alergias.length || 'ninguna'} · Antecedentes:{' '}
            {ficha.antecedentes.length || 'ninguno'}
          </p>
          <ul>
            {ficha.alergias.map((row) => (
              <li key={row.id_alergia}>
                {row.sustancia} ({row.severidad})
              </li>
            ))}
          </ul>
          <ul>
            {ficha.antecedentes.map((row) => (
              <li key={row.id_antecedente}>
                {row.tipo}: {row.descripcion}
              </li>
            ))}
          </ul>
          <label>
            Nueva alergia (sustancia)
            <input value={sustancia} onChange={(e) => setSustancia(e.target.value)} />
          </label>
          <button disabled={busy || !sustancia.trim()} onClick={() => void addAllergy()}>
            Registrar alergia
          </button>
        </>
      )}
    </section>
  );
}

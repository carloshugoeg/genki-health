import { useState } from 'react';
import { INSTITUTION_ENGINE_ASSIGNMENTS, type InstitutionKind } from '@genki/shared';
import { errorMessage, selectInstitution } from '../api';
import { navigate } from '../router';

const LABELS: Record<InstitutionKind, string> = {
  hospital_general: 'Hospital PG · institución 1',
  centro_pediatrico: 'Pediátrico MySQL · institución 2',
  laboratorio_clinico: 'Laboratorio Mongo · institución 3',
  clinica_odontologica: 'Odontología Firestore · institución 4',
};

export function Panel() {
  const [error, setError] = useState('');
  const [busy, setBusy] = useState<InstitutionKind | null>(null);
  async function enter(kind: InstitutionKind) {
    setBusy(kind);
    setError('');
    try {
      await selectInstitution(kind);
      navigate('/pacientes');
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(null);
    }
  }
  return (
    <section>
      <h2>Panel de superadministrador</h2>
      <p>Elija una institución para entrar en su contexto clínico.</p>
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      <nav className="actions" aria-label="Instituciones">
        {INSTITUTION_ENGINE_ASSIGNMENTS.map((i) => (
          <button
            key={i.kind}
            data-testid={`enter-${i.kind}`}
            disabled={busy !== null}
            onClick={() => void enter(i.kind)}
          >
            {busy === i.kind ? 'Entrando…' : LABELS[i.kind]}
          </button>
        ))}
      </nav>
    </section>
  );
}

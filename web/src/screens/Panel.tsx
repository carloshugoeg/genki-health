import { useState } from 'react';
import { INSTITUTION_ENGINE_ASSIGNMENTS, type InstitutionKind } from '@genki/shared';
import { errorMessage, selectInstitution } from '../api';
import { navigate } from '../router';
import { INSTITUTION_META, InstitutionMark } from '../components/InstitutionMark';

export function Panel() {
  const [error, setError] = useState('');
  const [busy, setBusy] = useState<InstitutionKind | null>(null);
  async function enter(kind: InstitutionKind) {
    setBusy(kind);
    setError('');
    try {
      await selectInstitution(kind);
      navigate('/inicio');
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(null);
    }
  }
  return (
    <section className="panel-screen">
      <h2>Panel de superadministrador</h2>
      <p className="muted">Elija una institución para entrar en su contexto clínico.</p>
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      <nav className="panel-grid" aria-label="Instituciones">
        {INSTITUTION_ENGINE_ASSIGNMENTS.map((i) => (
          <button
            key={i.kind}
            type="button"
            className="inst-option inst-option--card"
            data-institution={i.kind}
            data-testid={`enter-${i.kind}`}
            disabled={busy !== null}
            aria-busy={busy === i.kind}
            onClick={() => void enter(i.kind)}
          >
            <InstitutionMark kind={i.kind} size="lg" />
            <span>
              <strong>{i.nombre}</strong>
              <span className="inst-option-engine">
                Institución {INSTITUTION_META[i.kind].numero}, {INSTITUTION_META[i.kind].engine}
              </span>
              <span className="inst-option-cta">
                {busy === i.kind ? 'Entrando…' : 'Entrar a la institución'}
              </span>
            </span>
          </button>
        ))}
      </nav>
    </section>
  );
}

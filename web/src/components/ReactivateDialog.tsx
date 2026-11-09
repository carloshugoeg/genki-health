import { useState } from 'react';
import { api, ApiError, errorMessage } from '../api';

export function ReactivateDialog({
  patientId,
  patientLabel,
  onClose,
  onSuccess,
  onConflict,
}: {
  patientId: number;
  patientLabel?: string;
  onClose: () => void;
  onSuccess: () => void;
  onConflict: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const motivo = String(data.get('motivo') ?? '').trim();
    if (!motivo) {
      setError('Indique el motivo de reactivación.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      await api(`/api/pacientes/${patientId}/reactivacion`, {
        method: 'POST',
        headers: { 'Idempotency-Key': `react-${patientId}-${Date.now()}` },
        body: JSON.stringify({ motivo }),
      });
      onSuccess();
    } catch (e) {
      if (e instanceof ApiError && e.code === 'conflict') onConflict();
      else setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <dialog open className="modal" aria-labelledby="reactivate-title" onCancel={onClose}>
      <form onSubmit={(e) => void onSubmit(e)}>
        <h2 id="reactivate-title">
          Reactivar expediente de {patientLabel ?? `paciente ${patientId}`}
        </h2>
        <p className="muted dialog-lede">
          Se limpian los metadatos de archivo. El historial clínico se conserva.
        </p>
        <label>
          <span>
            Motivo<span className="req"> *</span>
          </span>
          <textarea
            name="motivo"
            data-testid="reactivate-motivo"
            required
            maxLength={300}
            rows={3}
          />
        </label>
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        <div className="actions dialog-actions">
          <button type="button" className="btn-secondary" onClick={onClose} disabled={busy}>
            Cancelar
          </button>
          <button data-testid="reactivate-confirm" disabled={busy}>
            {busy ? 'Reactivando…' : 'Confirmar reactivación'}
          </button>
        </div>
      </form>
    </dialog>
  );
}

import { useEffect, useRef, useState, type FormEvent } from 'react';
import type { ArchiveRequest, MotivoArchivo } from '@genki/shared';
import { api, ApiError, errorMessage } from '../api';

export function archiveRequest(reason: MotivoArchivo, observation: string): ArchiveRequest {
  const trimmed = observation.trim();
  return { motivo_archivo: reason, ...(trimmed ? { observacion_archivo: trimmed } : {}) };
}
export function ArchiveDialog({
  patientId,
  onClose,
  onSuccess,
  onConflict,
}: {
  patientId: number;
  onClose: () => void;
  onSuccess: () => void;
  onConflict: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const pending = useRef(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const element = dialog.current!;
    element.showModal();
    return () => {
      element.close();
      previous?.focus();
    };
  }, []);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending.current) return;
    const data = new FormData(event.currentTarget);
    if (!data.get('confirmed')) return;
    pending.current = true;
    setBusy(true);
    setError('');
    try {
      await api(`/api/pacientes/${patientId}/archivo`, {
        method: 'POST',
        body: JSON.stringify(
          archiveRequest(
            data.get('reason') as MotivoArchivo,
            String(data.get('observation') ?? ''),
          ),
        ),
      });
      onSuccess();
    } catch (e) {
      setError(errorMessage(e));
      if (e instanceof ApiError && e.code === 'already_archived') onConflict();
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }
  return (
    <dialog
      ref={dialog}
      aria-labelledby="archive-title"
      onCancel={(e) => {
        e.preventDefault();
        if (!busy) onClose();
      }}
    >
      <h2 id="archive-title">Archivar expediente del paciente {patientId}</h2>
      <p>
        El historial se conserva. El expediente saldrá de la búsqueda de activos y no admitirá
        nuevas consultas. No hay reactivación en esta entrega.
      </p>
      <form onSubmit={submit}>
        <fieldset disabled={busy}>
          <legend>Confirmación de archivo</legend>
          <label>
            Motivo *
            <select name="reason" data-testid="archive-reason" required defaultValue="">
              <option value="">Seleccione</option>
              <option value="traslado">Traslado</option>
              <option value="fallecimiento">Fallecimiento</option>
              <option value="administrativo">Administrativo</option>
              <option value="inactividad">Inactividad</option>
            </select>
          </label>
          <label>
            Observación
            <textarea name="observation" maxLength={500} />
          </label>
          <label className="radio">
            <input type="checkbox" name="confirmed" required />
            Confirmo que deseo archivar este expediente
          </label>
        </fieldset>
        {error && (
          <p className="error" role="alert">
            {error} Los datos del formulario se conservan.
          </p>
        )}
        <div className="actions">
          <button data-testid="archive-confirm" disabled={busy}>
            {busy ? 'Archivando…' : 'Confirmar archivo'}
          </button>
          <button type="button" disabled={busy} onClick={onClose}>
            Cancelar
          </button>
        </div>
      </form>
    </dialog>
  );
}

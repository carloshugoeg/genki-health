import { useRef, useState, type FormEvent } from 'react';
import { ApiError, errorMessage, uploadDocumento, type DocumentoAdjunto } from '../api';
import {
  DOCUMENT_ACCEPT,
  DOCUMENT_MAX_BYTES,
  bytesToBase64,
  documentMime,
  formatBytes,
  matchesMagic,
  validateDocumentMeta,
} from './documentFile';

function uploadError(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.code === 'payload_too_large' || error.status === 413) {
      return `El archivo excede el tamaño permitido (máximo ${formatBytes(DOCUMENT_MAX_BYTES)}).`;
    }
    if (error.code === 'invalid_body') {
      return 'El servidor rechazó el archivo: verifique que sea un PDF, JPEG o PNG válido, que no esté vacío y que el nombre no contenga "..".';
    }
    if (error.code === 'forbidden') return 'Su rol no permite adjuntar documentos.';
    if (error.code === 'not_found') return 'No se encontró el paciente o la consulta indicada.';
  }
  return errorMessage(error);
}

function displayDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('es-GT', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'America/Guatemala',
  }).format(date);
}

/**
 * Upload-only: the API has no list/download endpoint for DOCUMENTO_ADJUNTO yet, so the
 * section confirms each upload with the server's response instead of showing a list.
 */
export function DocumentosPanel({
  patientId,
  consultas,
  readOnly,
}: {
  patientId: number;
  consultas: Array<{ id_consulta: number; fecha_hora_inicio: string }>;
  readOnly: boolean;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [consulta, setConsulta] = useState<number | ''>('');
  const [error, setError] = useState('');
  const [saved, setSaved] = useState<(DocumentoAdjunto & { original: string }) | null>(null);
  const [busy, setBusy] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  function pick(next: File | null) {
    setSaved(null);
    setFile(next);
    setError(next ? (validateDocumentMeta(next) ?? '') : '');
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!file) {
      setError('Seleccione un archivo.');
      return;
    }
    const metaError = validateDocumentMeta(file);
    const mime = documentMime(file.name, file.type);
    if (metaError || !mime) {
      setError(metaError ?? 'Tipo de archivo no permitido. Solo se aceptan PDF, JPEG o PNG.');
      return;
    }
    setBusy(true);
    setError('');
    setSaved(null);
    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      if (!matchesMagic(bytes, mime)) {
        setError(
          'El contenido del archivo no corresponde a su extensión (se esperaba PDF, JPEG o PNG).',
        );
        return;
      }
      const result = await uploadDocumento(patientId, {
        archivo_base64: bytesToBase64(bytes),
        tipo_mime: mime,
        nombre_archivo: file.name.trim(),
        ...(consulta !== '' ? { id_consulta: consulta } : {}),
      });
      setSaved({ ...result, original: file.name.trim() });
      setFile(null);
      setConsulta('');
      if (input.current) input.current.value = '';
    } catch (e) {
      setError(uploadError(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section data-testid="documentos-panel">
      <h3>Documentos</h3>
      <p className="muted">
        Adjunte al expediente archivos PDF, JPEG o PNG de hasta {formatBytes(DOCUMENT_MAX_BYTES)}.
        El listado y la descarga de documentos aún no están disponibles.
      </p>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {saved && (
        <div className="notice" role="status" data-testid="documento-confirmacion">
          <p>
            Documento <strong>{saved.original}</strong> adjuntado al expediente.
          </p>
          <p className="muted">
            Documento #{saved.id_documento} · guardado como {saved.nombre_archivo} ·{' '}
            {saved.tipo_mime} · cargado {displayDate(saved.fecha_carga)}
            {saved.id_consulta ? ` · consulta ${saved.id_consulta}` : ''} · SHA-256{' '}
            {saved.hash_sha256.slice(0, 12)}…
          </p>
        </div>
      )}
      {readOnly ? (
        <p className="notice">El expediente está archivado; no se pueden adjuntar documentos.</p>
      ) : (
        <form className="documentos-form" onSubmit={(e) => void submit(e)}>
          <label>
            Archivo
            <input
              ref={input}
              type="file"
              name="archivo"
              accept={DOCUMENT_ACCEPT}
              disabled={busy}
              onChange={(e) => pick(e.target.files?.[0] ?? null)}
            />
          </label>
          {file && (
            <p className="muted">
              {file.name} · {formatBytes(file.size)}
            </p>
          )}
          <label>
            Consulta relacionada (opcional)
            <select
              name="id_consulta"
              value={consulta === '' ? '' : String(consulta)}
              disabled={busy}
              onChange={(e) => setConsulta(e.target.value === '' ? '' : Number(e.target.value))}
            >
              <option value="">Sin consulta</option>
              {consultas.map((c) => (
                <option key={c.id_consulta} value={c.id_consulta}>
                  Consulta {c.id_consulta} · {displayDate(c.fecha_hora_inicio)}
                </option>
              ))}
            </select>
          </label>
          <button type="submit" disabled={busy || !file || !!validateDocumentMeta(file)}>
            {busy ? 'Adjuntando…' : 'Adjuntar documento'}
          </button>
        </form>
      )}
    </section>
  );
}

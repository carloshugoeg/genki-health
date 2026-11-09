import { useRef, useState, type FormEvent } from 'react';
import type { EconomicClient } from '../charges/EconomicPage';
import type { InvoicePreview } from '@genki/shared/full/charges';
import type { FacturaCompleta } from '@genki/shared/full/invoicing';
import { EntitySelect } from '../../components/EntitySelect';
/** Preview is kept with its immutable input; changing selection invalidates it. */
export function InvoicingPage({ client }: { client: EconomicClient }) {
  const [patient, setPatient] = useState<number | ''>('');
  const [preview, setPreview] = useState<InvoicePreview | null>(null),
    [invoice, setInvoice] = useState<FacturaCompleta | null>(null),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false);
  const selection = useRef<{ patient: number; ids: number[] } | null>(null);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    setBusy(true);
    setError('');
    try {
      if (!preview) {
        const patient = Number(data.get('patient')),
          ids = String(data.get('charges'))
            .split(',')
            .map((x) => Number(x.trim()));
        const result = (await client(`/api/pacientes/${patient}/facturas/preview`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ cargo_ids: ids }),
        })) as InvoicePreview;
        selection.current = { patient, ids };
        setPreview(result);
      } else {
        const choice = selection.current!;
        const result = (await client(`/api/pacientes/${choice.patient}/facturas`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            cargo_ids: choice.ids,
            preview_hash: preview.preview_hash,
            serie: String(data.get('series')),
            nombre_receptor: String(data.get('name')),
            nit_receptor: String(data.get('nit')),
            descuento: String(data.get('discount') || '0.00'),
            cobertura_seguro: String(data.get('coverage') || '0.00'),
          }),
        })) as FacturaCompleta;
        setInvoice(result);
        setPreview(null);
        selection.current = null;
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se pudo completar la factura.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <section aria-label="Facturación">
      <h1>Facturación</h1>
      <form onSubmit={submit}>
        {!preview ? (
          <>
            <p>
              <label>
                Paciente{' '}
                <EntitySelect
                  kind="paciente"
                  name="patient"
                  value={patient}
                  onChange={setPatient}
                  required
                  disabled={busy}
                />
              </label>
            </p>
            <p>
              <label>
                Cargos separados por coma <input name="charges" required />
              </label>
            </p>
          </>
        ) : (
          <>
            <table>
              <thead>
                <tr>
                  <th>Cargo</th>
                  <th>Descripción</th>
                  <th>Subtotal Q</th>
                </tr>
              </thead>
              <tbody>
                {preview.cargos.map((c) => (
                  <tr key={c.id_cargo}>
                    <td>{c.id_cargo}</td>
                    <td>{c.descripcion}</td>
                    <td>{c.subtotal}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p>
              Subtotal Q{preview.subtotal}; IVA Q{preview.impuesto}; total antes de descuento Q
              {preview.total}
            </p>
            <p>
              <label>
                Serie <input name="series" required maxLength={20} />
              </label>
            </p>
            <p>
              <label>
                Nombre receptor <input name="name" required />
              </label>
            </p>
            <p>
              <label>
                NIT <input name="nit" required />
              </label>
            </p>
            <p>
              <label>
                Descuento Q <input name="discount" inputMode="decimal" />
              </label>
            </p>
            <p>
              <label>
                Cobertura de seguro Q <input name="coverage" inputMode="decimal" />
              </label>
            </p>
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                setPreview(null);
                selection.current = null;
              }}
            >
              Cambiar selección
            </button>
          </>
        )}
        <button type="submit" disabled={busy}>
          {busy ? 'Procesando…' : preview ? 'Emitir factura' : 'Previsualizar'}
        </button>
      </form>
      {error && <p role="alert">{error}</p>}
      {invoice && (
        <p role="status">
          Factura {invoice.factura.serie}-{invoice.factura.numero}: Q{invoice.factura.total}, saldo
          Q{invoice.factura.saldo_pendiente}
        </p>
      )}
    </section>
  );
}

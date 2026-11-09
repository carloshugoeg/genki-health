import { useState, type FormEvent } from 'react';
import type { CatalogosDto, ConsultaCompleta, ConsultaDto } from '@genki/shared';
import { api, errorMessage } from '../api';

/**
 * Mantenimiento de historiales (brief, Entrega II):
 * - `CerrarConsultaAbierta`: closes a consultation opened earlier (POST /api/consultas/:id/cierre)
 *   with its diagnosis, treatment and optional prescription in one atomic save.
 * - `CorreccionesConsulta`: audited corrections of a closed consultation. Nothing is deleted:
 *   annulment moves the row to its terminal status (descartado / suspendido / anulada) and the
 *   server writes the bitácora entry with the reason.
 * - `MantenimientoConsulta`: picks one of the two from the consultation state.
 */

const today = () => new Date().toISOString().slice(0, 10);

export function CerrarConsultaAbierta({
  consulta,
  catalogs,
  onClosed,
}: {
  consulta: ConsultaDto;
  catalogs: CatalogosDto | null;
  onClosed: (closed: ConsultaCompleta) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [recipe, setRecipe] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const data = new FormData(event.currentTarget);
    const text = (name: string) => String(data.get(name) ?? '').trim();
    const optional = (name: string) => text(name) || null;
    const fin = optional('fin');
    if (fin && fin < text('inicio')) {
      setError('El fin estimado no puede ser anterior al inicio del tratamiento.');
      return;
    }
    const body = {
      enfermedad_actual: optional('enfermedad_actual'),
      exploracion_fisica: optional('exploracion_fisica'),
      plan: optional('plan'),
      diagnosticos: [
        {
          codigo_cie10: optional('codigo'),
          descripcion: text('dx'),
          tipo: text('dx-tipo'),
          es_principal: true,
        },
      ],
      tratamientos: [
        {
          diagnostico_index: 0,
          tipo: text('tx-tipo'),
          descripcion: text('tx'),
          indicaciones: optional('tx-indicaciones'),
          fecha_inicio: text('inicio'),
          fecha_fin_estimada: fin,
          estado: 'activo',
        },
      ],
      ...(recipe
        ? {
            receta: {
              observaciones: optional('rx-observaciones'),
              detalles: [
                {
                  id_medicamento: Number(text('med')),
                  dosis: text('dosis'),
                  via_administracion: text('via'),
                  frecuencia_horas: Number(text('frecuencia')),
                  duracion_dias: Number(text('duracion')),
                  cantidad: Number(text('cantidad')),
                  indicaciones: optional('med-indicaciones'),
                },
              ],
            },
          }
        : {}),
    };
    setBusy(true);
    setError('');
    try {
      const closed = await api<ConsultaCompleta>(`/api/consultas/${consulta.id_consulta}/cierre`, {
        method: 'POST',
        body: JSON.stringify(body),
      });
      onClosed(closed);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="form-stack" aria-label="Cerrar consulta abierta">
      <p className="notice">
        Consulta {consulta.id_consulta} abierta ({consulta.motivo_consulta}). Mientras siga abierta
        el expediente no puede archivarse. Al cerrar se guardan diagnóstico, tratamiento y receta en
        una sola operación.
      </p>
      <fieldset disabled={busy}>
        <legend>Diagnóstico principal</legend>
        <div className="form-grid">
          <label>
            Código CIE-10
            <select name="codigo" defaultValue="">
              <option value="">Sin código</option>
              {catalogs?.cie10?.map((c) => (
                <option key={c.codigo_cie10} value={c.codigo_cie10}>
                  {c.codigo_cie10} · {c.descripcion}
                </option>
              ))}
            </select>
          </label>
          <label>
            Descripción *<textarea name="dx" required maxLength={500} />
          </label>
          <label>
            Tipo *
            <select name="dx-tipo">
              <option value="presuntivo">Presuntivo</option>
              <option value="definitivo">Definitivo</option>
            </select>
          </label>
        </div>
      </fieldset>
      <fieldset disabled={busy}>
        <legend>Tratamiento</legend>
        <div className="form-grid">
          <label>
            Tipo *
            <select name="tx-tipo">
              {['farmacologico', 'procedimiento', 'terapia', 'reposo', 'dieta'].map((t) => (
                <option key={t} value={t}>
                  {t === 'farmacologico' ? 'Farmacológico' : t}
                </option>
              ))}
            </select>
          </label>
          <label>
            Descripción *<textarea name="tx" required maxLength={1000} />
          </label>
          <label>
            Indicaciones
            <textarea name="tx-indicaciones" maxLength={1000} />
          </label>
          <label>
            Fecha de inicio *
            <input name="inicio" type="date" defaultValue={today()} required />
          </label>
          <label>
            Fin estimado
            <input name="fin" type="date" />
          </label>
        </div>
      </fieldset>
      <fieldset disabled={busy}>
        <legend>Notas de cierre</legend>
        <div className="form-grid">
          {(
            [
              ['enfermedad_actual', 'Enfermedad actual'],
              ['exploracion_fisica', 'Exploración física'],
              ['plan', 'Plan'],
            ] as const
          ).map(([name, label]) => (
            <label key={name}>
              {label}
              <textarea name={name} maxLength={2000} />
            </label>
          ))}
        </div>
      </fieldset>
      <label className="radio">
        <input
          type="checkbox"
          checked={recipe}
          disabled={busy}
          onChange={(e) => setRecipe(e.target.checked)}
        />
        Incluir receta
      </label>
      {recipe && (
        <fieldset disabled={busy}>
          <legend>Receta</legend>
          <div className="form-grid">
            <label>
              Medicamento *
              <select name="med" required defaultValue="">
                <option value="">Seleccione</option>
                {catalogs?.medicamentos.map((m) => (
                  <option key={m.id_medicamento} value={m.id_medicamento}>
                    {m.nombre_generico}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Dosis *<input name="dosis" required maxLength={100} />
            </label>
            <label>
              Vía *<input name="via" required maxLength={50} />
            </label>
            <label>
              Frecuencia (horas) *
              <input name="frecuencia" type="number" min={1} max={168} step={1} required />
            </label>
            <label>
              Duración (días) *
              <input name="duracion" type="number" min={1} max={365} step={1} required />
            </label>
            <label>
              Cantidad *
              <input
                name="cantidad"
                type="number"
                min={0.01}
                max={999999.99}
                step={0.01}
                required
              />
            </label>
            <label>
              Indicaciones
              <textarea name="med-indicaciones" maxLength={1000} />
            </label>
            <label>
              Observaciones
              <textarea name="rx-observaciones" maxLength={1000} />
            </label>
          </div>
        </fieldset>
      )}
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      <div className="form-footer">
        <button type="submit" className="btn-primary" disabled={busy}>
          {busy ? 'Cerrando…' : 'Cerrar consulta'}
        </button>
      </div>
    </form>
  );
}

type Segment = 'diagnosticos' | 'tratamientos' | 'recetas';
interface PendingAction {
  key: string;
  label: string;
  url: string;
  method: 'PATCH' | 'POST';
  body: Record<string, unknown>;
  danger: boolean;
}

function action(
  segment: Segment,
  id: number,
  label: string,
  change: Record<string, unknown> | null,
): PendingAction {
  return {
    key: `${segment}-${id}-${label}`,
    label,
    url: change ? `/api/${segment}/${id}` : `/api/${segment}/${id}/anulacion`,
    method: change ? 'PATCH' : 'POST',
    body: change ?? {},
    danger: change === null,
  };
}

export function CorreccionesConsulta({
  bundle,
  onChanged,
}: {
  bundle: ConsultaCompleta;
  onChanged: () => void;
}) {
  const [pending, setPending] = useState<PendingAction | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const rows: Array<{ title: string; estado: string; actions: PendingAction[] }> = [
    ...bundle.diagnosticos.map((d) => ({
      title: `Diagnóstico ${d.id_diagnostico}: ${d.descripcion}`,
      estado: d.tipo,
      actions:
        d.tipo === 'descartado'
          ? []
          : [
              ...(d.tipo === 'presuntivo'
                ? [
                    action('diagnosticos', d.id_diagnostico, 'Confirmar definitivo', {
                      tipo: 'definitivo',
                    }),
                  ]
                : []),
              action('diagnosticos', d.id_diagnostico, 'Descartar', null),
            ],
    })),
    ...bundle.tratamientos.map((t) => ({
      title: `Tratamiento ${t.id_tratamiento}: ${t.descripcion}`,
      estado: t.estado,
      actions:
        t.estado === 'suspendido'
          ? []
          : [
              ...(t.estado === 'activo'
                ? [action('tratamientos', t.id_tratamiento, 'Finalizar', { estado: 'finalizado' })]
                : []),
              action('tratamientos', t.id_tratamiento, 'Suspender', null),
            ],
    })),
    ...(bundle.receta
      ? [
          {
            title: `Receta ${bundle.receta.folio}`,
            estado: bundle.receta.estado,
            actions:
              bundle.receta.estado === 'anulada'
                ? []
                : [action('recetas', bundle.receta.id_receta, 'Anular receta', null)],
          },
        ]
      : []),
  ];

  async function confirm(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!pending || busy) return;
    const motivo = String(new FormData(event.currentTarget).get('motivo') ?? '').trim();
    if (!motivo) {
      setError('Indique el motivo; queda registrado en la bitácora.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      await api(pending.url, {
        method: pending.method,
        body: JSON.stringify({ ...pending.body, motivo }),
      });
      setPending(null);
      onChanged();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  if (!rows.length) return null;
  return (
    <details>
      <summary>Corregir o anular (con bitácora)</summary>
      <p className="muted">
        Los registros clínicos no se borran: anular cambia su estado y deja constancia del motivo.
      </p>
      <table className="data-table">
        <tbody>
          {rows.map((row) => (
            <tr key={row.title}>
              <td>{row.title}</td>
              <td>
                <span className={`badge badge--${row.estado}`}>{row.estado}</span>
              </td>
              <td className="actions">
                {row.actions.map((a) => (
                  <button
                    key={a.key}
                    type="button"
                    className={a.danger ? 'btn-danger-quiet' : 'btn-secondary'}
                    disabled={busy}
                    onClick={() => {
                      setError('');
                      setPending(a);
                    }}
                  >
                    {a.label}
                  </button>
                ))}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {pending && (
        <form onSubmit={confirm} className="inline-form" aria-label="Confirmar corrección">
          <label>
            Motivo de «{pending.label}» *
            <input name="motivo" required maxLength={300} autoFocus />
          </label>
          <div className="dialog-actions">
            <button
              type="submit"
              className={pending.danger ? 'btn-danger' : 'btn-primary'}
              disabled={busy}
            >
              {busy ? 'Guardando…' : 'Confirmar'}
            </button>
            <button
              type="button"
              className="btn-ghost"
              disabled={busy}
              onClick={() => setPending(null)}
            >
              Cancelar
            </button>
          </div>
        </form>
      )}
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
    </details>
  );
}

/**
 * Mount inside each consultation entry of the patient history. `canEdit` should be true only for
 * clinical roles (medico / odontologo / superadministrador) on an active expediente.
 */
export function MantenimientoConsulta({
  bundle,
  catalogs,
  canEdit,
  onChanged,
}: {
  bundle: ConsultaCompleta;
  catalogs: CatalogosDto | null;
  canEdit: boolean;
  onChanged: () => void;
}) {
  if (!canEdit) return null;
  if (bundle.consulta.estado === 'abierta')
    return (
      <details>
        <summary>Cerrar consulta abierta</summary>
        <CerrarConsultaAbierta
          consulta={bundle.consulta}
          catalogs={catalogs}
          onClosed={onChanged}
        />
      </details>
    );
  if (bundle.consulta.estado === 'cerrada')
    return <CorreccionesConsulta bundle={bundle} onChanged={onChanged} />;
  return null;
}

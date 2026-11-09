import { useEffect, useState } from 'react';
import {
  INSTITUTION_ENGINE_ASSIGNMENTS,
  type AuthPrincipalDto,
  type CatalogosDto,
  type HistorialDto,
} from '@genki/shared';
import { api, errorMessage } from '../api';
import { formatEntityLabel, pacienteLabel } from '../components/EntitySelect';
import { navigate } from '../router';
import { ArchiveDialog } from '../components/ArchiveDialog';
import { ReactivateDialog } from '../components/ReactivateDialog';
import { FichaLane1 } from '../full/FichaLane1';
import { SpecialtyPanels } from '../full/SpecialtyPanels';
import { DocumentosPanel } from '../full/DocumentosPanel';
import { MantenimientoConsulta } from '../components/MantenimientoConsulta';
import { canAccess } from '../full/clinicalAccess';
import { Consulta } from './Consulta';
import { INSTITUTION_META } from '../components/InstitutionMark';

const labels: Record<string, string> = {
  id_paciente: 'Paciente',
  id_institucion: 'Institución',
  tipo_documento: 'Tipo de documento',
  numero_documento: 'Documento',
  primer_nombre: 'Primer nombre',
  segundo_nombre: 'Segundo nombre',
  primer_apellido: 'Primer apellido',
  segundo_apellido: 'Segundo apellido',
  fecha_nacimiento: 'Fecha de nacimiento',
  sexo: 'Sexo',
  tipo_sangre: 'Tipo de sangre',
  telefono: 'Teléfono',
  correo: 'Correo',
  direccion: 'Dirección',
  id_municipio: 'Municipio',
  fecha_registro: 'Fecha de registro',
  id_expediente: 'N.º interno del expediente',
  numero_expediente: 'Número de expediente',
  fecha_apertura: 'Fecha de apertura',
  fecha_archivo: 'Fecha de archivo',
  motivo_archivo: 'Motivo de archivo',
  observacion_archivo: 'Observación de archivo',
  id_consulta: 'N.º de consulta',
  id_profesional: 'Profesional',
  id_cita: 'Cita',
  fecha_hora_inicio: 'Inicio',
  fecha_hora_fin: 'Cierre',
  tipo: 'Tipo',
  motivo_consulta: 'Motivo de consulta',
  enfermedad_actual: 'Enfermedad actual',
  exploracion_fisica: 'Exploración física',
  plan: 'Plan',
  id_diagnostico: 'N.º de diagnóstico',
  codigo_cie10: 'Código CIE-10',
  descripcion: 'Descripción',
  es_principal: 'Principal',
  id_tratamiento: 'N.º de tratamiento',
  indicaciones: 'Indicaciones',
  fecha_inicio: 'Fecha de inicio',
  fecha_fin_estimada: 'Fecha de fin estimada',
  id_receta: 'N.º de receta',
  folio: 'Folio',
  fecha_emision: 'Fecha de emisión',
  observaciones: 'Observaciones',
  id_medicamento: 'Medicamento',
  dosis: 'Dosis',
  via_administracion: 'Vía de administración',
  frecuencia_horas: 'Frecuencia (horas)',
  duracion_dias: 'Duración (días)',
  cantidad: 'Cantidad',
  estado: 'Estado',
};
const timestamps = new Set([
  'fecha_registro',
  'fecha_apertura',
  'fecha_archivo',
  'fecha_hora_inicio',
  'fecha_hora_fin',
  'fecha_emision',
]);
/** Calendar dates (YYYY-MM-DD) are shown without time-zone shifting. */
const dates = new Set(['fecha_nacimiento', 'fecha_inicio', 'fecha_fin_estimada']);
/** Snake-case catalog values shown as readable Spanish (display only). */
const enums = new Set(['tipo', 'estado', 'motivo_archivo', 'via_administracion']);
export function humanize(value: string): string {
  const text = value.replace(/_/g, ' ');
  return text.charAt(0).toUpperCase() + text.slice(1);
}
function displayDate(value: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  return new Intl.DateTimeFormat('es-GT', { dateStyle: 'medium', timeZone: 'UTC' }).format(
    new Date(`${value}T00:00:00Z`),
  );
}
export function displayTime(value: string): string {
  return new Intl.DateTimeFormat('es-GT', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'America/Guatemala',
  }).format(new Date(value));
}
function Fields({
  value,
  resolve,
}: {
  value: object;
  resolve?: (key: string, value: unknown) => string | null;
}) {
  const entries = Object.entries(value);
  return (
    <dl className="clinical-fields">
      {Object.keys(labels)
        .filter((key) => Object.hasOwn(value, key))
        .map((key) => {
          const v: unknown = entries.find(([name]) => name === key)?.[1];
          const named = resolve?.(key, v);
          return (
            <div key={key}>
              <dt>{labels[key]}</dt>
              <dd>
                {v == null || v === ''
                  ? 'Sin especificar'
                  : named
                    ? named
                    : typeof v === 'boolean'
                      ? v
                        ? 'Sí'
                        : 'No'
                      : timestamps.has(key) && typeof v === 'string'
                        ? displayTime(v)
                        : dates.has(key) && typeof v === 'string'
                          ? displayDate(v)
                          : enums.has(key) && typeof v === 'string' && /^[a-z_]+$/.test(v)
                            ? humanize(v)
                            : String(v)}
              </dd>
            </div>
          );
        })}
    </dl>
  );
}
export function mutationActions(state: string, roles: string[]) {
  const admin = roles.includes('superadministrador') || roles.includes('administrador');
  return {
    consulta: state === 'activo' && roles.some((r) => ['administrador', 'medico'].includes(r)),
    archive: state === 'activo' && roles.some((r) => ['administrador', 'recepcion'].includes(r)),
    reactivate: state === 'archivado' && admin,
  };
}
export function HistoryContent({
  history,
  catalogs,
  principal,
  onChanged,
}: {
  history: HistorialDto;
  catalogs: CatalogosDto | null;
  principal: AuthPrincipalDto;
  onChanged?: () => void;
}) {
  const canMaintain =
    history.expediente.estado === 'activo' &&
    ['medico', 'odontologo', 'superadministrador'].some((role) => principal.roles.includes(role));
  const nameOf = (key: string, value: unknown): string | null => {
    if (typeof value !== 'number') return null;
    if (key === 'id_paciente') return pacienteLabel(history.paciente);
    if (key === 'id_institucion') {
      const kind = principal.institution_kind;
      const row = INSTITUTION_ENGINE_ASSIGNMENTS.find((i) => i.kind === kind);
      return row && value === principal.id_institucion
        ? `${row.nombre} (${INSTITUTION_META[row.kind].engine})`
        : null;
    }
    if (key === 'id_municipio') {
      return catalogs?.municipios.find((m) => Number(m.id_municipio) === value)?.nombre ?? null;
    }
    if (key === 'id_profesional') {
      const match = catalogs?.profesionales.find((row) => Number(row.id_profesional) === value);
      return match ? formatEntityLabel(match.nombres, match.apellidos, value) : null;
    }
    return null;
  };
  const consultations = [...history.consultas].sort(
    (a, b) =>
      b.consulta.fecha_hora_inicio.localeCompare(a.consulta.fecha_hora_inicio) ||
      Number(b.consulta.id_consulta) - Number(a.consulta.id_consulta),
  );
  return (
    <>
      <section>
        <h3>Identidad y contacto</h3>
        <Fields value={history.paciente} resolve={nameOf} />
      </section>
      <section>
        <h3>Expediente</h3>
        <p data-testid="ficha-state">
          <strong>{history.expediente.estado === 'archivado' ? 'Archivado' : 'Activo'}</strong>
        </p>
        <Fields value={history.expediente} resolve={nameOf} />
      </section>
      {canAccess(principal.roles, 'ficha') && (
        <FichaLane1 patientId={history.paciente.id_paciente} />
      )}
      {canAccess(principal.roles, 'documentos') && (
        <DocumentosPanel
          patientId={history.paciente.id_paciente}
          consultas={consultations.map((bundle) => ({
            id_consulta: Number(bundle.consulta.id_consulta),
            fecha_hora_inicio: bundle.consulta.fecha_hora_inicio,
          }))}
          readOnly={history.expediente.estado === 'archivado'}
        />
      )}
      <SpecialtyPanels
        patientId={history.paciente.id_paciente}
        principal={principal}
        archived={history.expediente.estado === 'archivado'}
        diagnosticos={consultations.flatMap((bundle) =>
          bundle.diagnosticos.map((d) => ({
            id_diagnostico: Number(d.id_diagnostico),
            id_consulta: Number(d.id_consulta),
            codigo_cie10: d.codigo_cie10,
            descripcion: d.descripcion,
            es_principal: d.es_principal,
          })),
        )}
      />
      <section>
        <h3>Historial de consultas</h3>
        <p className="muted">
          Fechas y horas en America/Guatemala (UTC-6). No incluye hospitalizaciones ni exámenes
          especializados.
        </p>
        {!consultations.length && (
          <p className="state-panel state-panel--empty">No hay consultas registradas.</p>
        )}
        {consultations.map((bundle) => (
          <article key={bundle.consulta.id_consulta} className="clinical-entry">
            <h4>
              <span>Consulta {bundle.consulta.id_consulta}</span>{' '}
              <span className="entry-date">{displayTime(bundle.consulta.fecha_hora_inicio)}</span>{' '}
              <span className={`badge badge--${bundle.consulta.estado}`}>
                {humanize(String(bundle.consulta.estado))}
              </span>
            </h4>
            <Fields value={bundle.consulta} resolve={nameOf} />
            <details>
              <summary>Diagnósticos ({bundle.diagnosticos.length})</summary>
              {[...bundle.diagnosticos]
                .sort((a, b) => Number(a.id_diagnostico) - Number(b.id_diagnostico))
                .map((d) => (
                  <section key={d.id_diagnostico}>
                    <h5>Diagnóstico {d.id_diagnostico}</h5>
                    <Fields value={d} />
                  </section>
                ))}
            </details>
            <details>
              <summary>Tratamientos ({bundle.tratamientos.length})</summary>
              {[...bundle.tratamientos]
                .sort((a, b) => Number(a.id_tratamiento) - Number(b.id_tratamiento))
                .map((t) => (
                  <section key={t.id_tratamiento}>
                    <h5>Tratamiento {t.id_tratamiento}</h5>
                    <Fields value={t} />
                  </section>
                ))}
            </details>
            {bundle.receta ? (
              <details>
                <summary>Receta {bundle.receta.folio}</summary>
                <Fields value={bundle.receta} />
                <h5>Detalle de medicamentos</h5>
                {[...bundle.detalles]
                  .sort((a, b) => a.id_medicamento - b.id_medicamento)
                  .map((d) => (
                    <section key={d.id_medicamento}>
                      <h6>
                        {catalogs?.medicamentos.find((m) => m.id_medicamento === d.id_medicamento)
                          ?.nombre_generico ?? `Medicamento ${d.id_medicamento}`}
                      </h6>
                      <Fields value={d} />
                    </section>
                  ))}
              </details>
            ) : (
              <p className="muted">Sin receta.</p>
            )}
            <MantenimientoConsulta
              bundle={bundle}
              catalogs={catalogs}
              canEdit={canMaintain}
              onChanged={onChanged ?? (() => undefined)}
            />
          </article>
        ))}
      </section>
    </>
  );
}
export function Historial({
  patientId,
  composing,
  principal,
}: {
  patientId: number;
  composing: boolean;
  principal: AuthPrincipalDto;
}) {
  const [history, setHistory] = useState<HistorialDto | null>(null);
  const [catalogs, setCatalogs] = useState<CatalogosDto | null>(null);
  const [error, setError] = useState('');
  const [catalogError, setCatalogError] = useState('');
  const [retry, setRetry] = useState(0);
  const [catalogRetry, setCatalogRetry] = useState(0);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [reactivateOpen, setReactivateOpen] = useState(false);
  const [draftOpened, setDraftOpened] = useState(composing);
  useEffect(() => {
    if (composing) setDraftOpened(true);
  }, [composing]);
  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    void api<HistorialDto>(`/api/pacientes/${patientId}`)
      .then((h) => {
        if (active) setHistory(h);
      })
      .catch((e) => {
        if (active) setError(errorMessage(e));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [patientId, retry]);
  useEffect(() => {
    let active = true;
    setCatalogError('');
    void api<CatalogosDto>('/api/catalogos')
      .then((c) => {
        if (active) setCatalogs(c);
      })
      .catch((e) => {
        if (active) setCatalogError(errorMessage(e));
      });
    return () => {
      active = false;
    };
  }, [catalogRetry]);
  const actions = mutationActions(history?.expediente.estado ?? '', principal.roles);
  function refresh(message: string) {
    setLoading(true);
    setMessage(message);
    setRetry((n) => n + 1);
  }
  return (
    <section>
      <h2>{composing ? 'Nueva consulta' : 'Ficha del paciente'}</h2>
      {history && (
        <p className="record-subtitle">
          <strong>{pacienteLabel(history.paciente)}</strong>{' '}
          <span className="cell-code">{history.expediente.numero_expediente}</span>{' '}
          <span className={`badge badge--${history.expediente.estado}`}>
            {history.expediente.estado === 'archivado' ? 'Archivado' : 'Activo'}
          </span>
        </p>
      )}
      {principal.institution_kind === 'laboratorio_clinico' && (
        <p className="notice">
          Consulta compartida como extensión académica del núcleo. No es un flujo de exámenes de
          laboratorio.
        </p>
      )}
      {message && (
        <p role="status" className="notice">
          {message}
        </p>
      )}
      {loading && (
        <p role="status" className="state-panel state-panel--loading">
          Cargando ficha…
        </p>
      )}
      {error && (
        <div role="alert" className="state-panel state-panel--error">
          <p className="error">{error}</p>
          <button type="button" className="btn-secondary" onClick={() => setRetry((n) => n + 1)}>
            Reintentar ficha
          </button>
        </div>
      )}
      {catalogError && (
        <div role="alert" className="state-panel state-panel--error">
          <p className="error">Catálogos: {catalogError}</p>
          <button
            type="button"
            className="btn-secondary"
            onClick={() => setCatalogRetry((n) => n + 1)}
          >
            Reintentar catálogos
          </button>
        </div>
      )}
      {!composing && history && (
        <>
          <HistoryContent
            history={history}
            catalogs={catalogs}
            principal={principal}
            onChanged={() => refresh('Consulta actualizada.')}
          />
        </>
      )}
      {draftOpened && (
        <div hidden={!composing}>
          <Consulta
            patientId={patientId}
            catalogs={catalogs}
            canSubmit={actions.consulta && !loading && !error && !catalogError}
            onSaved={() => {
              refresh('Consulta cerrada guardada.');
              setDraftOpened(false);
              navigate(`/pacientes/${patientId}`);
            }}
            onArchived={() => {
              refresh(
                'El expediente fue archivado. No se guardó la consulta; su borrador se conserva mientras permanezca en esta ficha.',
              );
              navigate(`/pacientes/${patientId}`);
            }}
          />
        </div>
      )}
      {archiveOpen && (
        <ArchiveDialog
          patientId={patientId}
          {...(history ? { patientLabel: pacienteLabel(history.paciente) } : {})}
          onClose={() => setArchiveOpen(false)}
          onSuccess={() => {
            setArchiveOpen(false);
            refresh(
              'Expediente archivado. Historial conservado; excluido de la búsqueda de activos.',
            );
          }}
          onConflict={() => refresh('El expediente ya está archivado. Se actualizó la ficha.')}
        />
      )}
      {reactivateOpen && (
        <ReactivateDialog
          patientId={patientId}
          {...(history ? { patientLabel: pacienteLabel(history.paciente) } : {})}
          onClose={() => setReactivateOpen(false)}
          onSuccess={() => {
            setReactivateOpen(false);
            refresh('Expediente reactivado. Metadatos de archivo limpiados; historial conservado.');
          }}
          onConflict={() => refresh('El expediente no está archivado. Se actualizó la ficha.')}
        />
      )}
      <div className="actions record-actions">
        {!composing && history && (
          <>
            {actions.consulta && (
              <button
                type="button"
                className="btn-primary"
                data-testid="consulta-new"
                disabled={loading || !!error}
                onClick={() => navigate(`/pacientes/${patientId}/consulta/nueva`)}
              >
                Nueva consulta
              </button>
            )}
            {draftOpened && !actions.consulta && (
              <button
                type="button"
                className="btn-secondary"
                onClick={() => navigate(`/pacientes/${patientId}/consulta/nueva`)}
              >
                Ver borrador no guardado
              </button>
            )}
            {actions.reactivate && (
              <button
                type="button"
                className="btn-secondary"
                data-testid="reactivate-open"
                disabled={loading || !!error}
                onClick={() => setReactivateOpen(true)}
              >
                Reactivar expediente
              </button>
            )}
            {actions.archive && (
              <button
                type="button"
                className="btn-danger-quiet"
                data-testid="archive-open"
                disabled={loading || !!error}
                onClick={() => setArchiveOpen(true)}
              >
                Archivar expediente
              </button>
            )}
          </>
        )}
        {!composing && (
          <button type="button" className="btn-ghost" onClick={() => navigate('/pacientes')}>
            Volver a pacientes
          </button>
        )}
      </div>
    </section>
  );
}

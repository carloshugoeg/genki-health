import { useEffect, useState } from 'react';
import type { AuthPrincipalDto, CatalogosDto, HistorialDto } from '@genki/shared';
import { api, errorMessage } from '../api';
import { navigate } from '../router';
import { ArchiveDialog } from '../components/ArchiveDialog';
import { FichaLane1 } from '../full/FichaLane1';
import { Consulta } from './Consulta';

const labels: Record<string, string> = {
  id_paciente: 'ID del paciente',
  id_institucion: 'ID de institución',
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
  id_municipio: 'ID del municipio',
  fecha_registro: 'Fecha de registro',
  id_expediente: 'ID del expediente',
  numero_expediente: 'Número de expediente',
  fecha_apertura: 'Fecha de apertura',
  fecha_archivo: 'Fecha de archivo',
  motivo_archivo: 'Motivo de archivo',
  observacion_archivo: 'Observación de archivo',
  id_consulta: 'ID de consulta',
  id_profesional: 'ID del profesional',
  id_cita: 'ID de cita',
  fecha_hora_inicio: 'Inicio',
  fecha_hora_fin: 'Cierre',
  tipo: 'Tipo',
  motivo_consulta: 'Motivo de consulta',
  enfermedad_actual: 'Enfermedad actual',
  exploracion_fisica: 'Exploración física',
  plan: 'Plan',
  id_diagnostico: 'ID de diagnóstico',
  codigo_cie10: 'Código CIE-10',
  descripcion: 'Descripción',
  es_principal: 'Principal',
  id_tratamiento: 'ID de tratamiento',
  indicaciones: 'Indicaciones',
  fecha_inicio: 'Fecha de inicio',
  fecha_fin_estimada: 'Fecha de fin estimada',
  id_receta: 'ID de receta',
  folio: 'Folio',
  fecha_emision: 'Fecha de emisión',
  observaciones: 'Observaciones',
  id_medicamento: 'ID del medicamento',
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
export function displayTime(value: string): string {
  return new Intl.DateTimeFormat('es-GT', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'America/Guatemala',
  }).format(new Date(value));
}
function Fields({ value }: { value: object }) {
  const entries = Object.entries(value);
  return (
    <dl className="clinical-fields">
      {Object.keys(labels)
        .filter((key) => Object.hasOwn(value, key))
        .map((key) => {
          const v: unknown = entries.find(([name]) => name === key)?.[1];
          return (
            <div key={key}>
              <dt>{labels[key]}</dt>
              <dd>
                {v == null || v === ''
                  ? 'Sin especificar'
                  : typeof v === 'boolean'
                    ? v
                      ? 'Sí'
                      : 'No'
                    : timestamps.has(key) && typeof v === 'string'
                      ? displayTime(v)
                      : String(v)}
              </dd>
            </div>
          );
        })}
    </dl>
  );
}
export function mutationActions(state: string, roles: string[]) {
  return {
    consulta: state === 'activo' && roles.some((r) => ['administrador', 'medico'].includes(r)),
    archive: state === 'activo' && roles.some((r) => ['administrador', 'recepcion'].includes(r)),
  };
}
export function HistoryContent({
  history,
  catalogs,
}: {
  history: HistorialDto;
  catalogs: CatalogosDto | null;
}) {
  const consultations = [...history.consultas].sort(
    (a, b) =>
      b.consulta.fecha_hora_inicio.localeCompare(a.consulta.fecha_hora_inicio) ||
      Number(b.consulta.id_consulta) - Number(a.consulta.id_consulta),
  );
  return (
    <>
      <section>
        <h3>Identidad y contacto</h3>
        <Fields value={history.paciente} />
      </section>
      <section>
        <h3>Expediente</h3>
        <p data-testid="ficha-state">
          <strong>{history.expediente.estado === 'archivado' ? 'Archivado' : 'Activo'}</strong>
        </p>
        <Fields value={history.expediente} />
      </section>
      <FichaLane1 patientId={history.paciente.id_paciente} />
      <section>
        <h3>Historial de consultas</h3>
        <p className="muted">
          Fechas y horas en America/Guatemala (UTC-6). No incluye hospitalizaciones ni exámenes
          especializados.
        </p>
        {!consultations.length && <p>No hay consultas registradas.</p>}
        {consultations.map((bundle) => (
          <article key={bundle.consulta.id_consulta} className="clinical-entry">
            <h4>
              Consulta {bundle.consulta.id_consulta} ·{' '}
              {displayTime(bundle.consulta.fecha_hora_inicio)}
            </h4>
            <Fields value={bundle.consulta} />
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
              <p>Sin receta.</p>
            )}
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
      {loading && <p role="status">Cargando ficha…</p>}
      {error && (
        <div role="alert">
          <p className="error">{error}</p>
          <button onClick={() => setRetry((n) => n + 1)}>Reintentar ficha</button>
        </div>
      )}
      {catalogError && (
        <div role="alert">
          <p className="error">Catálogos: {catalogError}</p>
          <button onClick={() => setCatalogRetry((n) => n + 1)}>Reintentar catálogos</button>
        </div>
      )}
      {!composing && history && (
        <>
          <HistoryContent history={history} catalogs={catalogs} />
          <div className="actions">
            {actions.consulta && (
              <button
                data-testid="consulta-new"
                disabled={loading || !!error}
                onClick={() => navigate(`/pacientes/${patientId}/consulta/nueva`)}
              >
                Nueva consulta
              </button>
            )}
            {actions.archive && (
              <button
                data-testid="archive-open"
                disabled={loading || !!error}
                onClick={() => setArchiveOpen(true)}
              >
                Archivar expediente
              </button>
            )}
            {draftOpened && !actions.consulta && (
              <button onClick={() => navigate(`/pacientes/${patientId}/consulta/nueva`)}>
                Ver borrador no guardado
              </button>
            )}
          </div>
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
      <button type="button" onClick={() => navigate('/pacientes')}>
        Volver a pacientes
      </button>
    </section>
  );
}

import { useRef, useState, type FormEvent } from 'react';
import type {
  CatalogosDto,
  CloseConsultaRequest,
  ConsultaCompleta,
  DiagnosticoInput,
  TratamientoInput,
} from '@genki/shared';
import { api, ApiError, errorMessage } from '../api';

export interface TreatmentRow {
  id: number;
  diagnosis: number;
}
export function buildConsulta(
  data: FormData,
  diagnoses: number[],
  treatments: TreatmentRow[],
  medications: number[],
): CloseConsultaRequest {
  const text = (name: string) => String(data.get(name) ?? '').trim();
  const optional = (name: string) => text(name) || null;
  return {
    id_profesional: Number(text('id_profesional')),
    fecha_hora_inicio: text('fecha_hora_inicio'),
    tipo: text('tipo') as CloseConsultaRequest['tipo'],
    motivo_consulta: text('motivo_consulta'),
    enfermedad_actual: optional('enfermedad_actual'),
    exploracion_fisica: optional('exploracion_fisica'),
    plan: optional('plan'),
    diagnosticos: diagnoses.map((id) => ({
      codigo_cie10: optional(`d${id}-codigo`),
      descripcion: text(`d${id}-descripcion`),
      tipo: text(`d${id}-tipo`) as DiagnosticoInput['tipo'],
      es_principal: text('primary') === String(id),
    })),
    tratamientos: treatments.map((row) => ({
      diagnostico_index: diagnoses.indexOf(row.diagnosis),
      tipo: text(`t${row.id}-tipo`) as TratamientoInput['tipo'],
      descripcion: text(`t${row.id}-descripcion`),
      indicaciones: optional(`t${row.id}-indicaciones`),
      fecha_inicio: text(`t${row.id}-inicio`),
      fecha_fin_estimada: optional(`t${row.id}-fin`),
      estado: 'activo',
    })),
    ...(data.get('recipe')
      ? {
          receta: {
            observaciones: optional('receta-observaciones'),
            detalles: medications.map((id) => ({
              id_medicamento: Number(text(`m${id}-id`)),
              dosis: text(`m${id}-dosis`),
              via_administracion: text(`m${id}-via`),
              frecuencia_horas: Number(text(`m${id}-frecuencia`)),
              duracion_dias: Number(text(`m${id}-duracion`)),
              cantidad: Number(text(`m${id}-cantidad`)),
              indicaciones: optional(`m${id}-indicaciones`),
            })),
          },
        }
      : {}),
  };
}
export function bundleError(
  bundle: CloseConsultaRequest,
  now = new Date().toISOString(),
): string | null {
  if (bundle.diagnosticos.filter((d) => d.es_principal).length !== 1)
    return 'Seleccione exactamente un diagnóstico principal.';
  if (
    !bundle.diagnosticos.length ||
    bundle.diagnosticos.length > 10 ||
    bundle.tratamientos.length > 20 ||
    bundle.diagnosticos.some((_, i) => !bundle.tratamientos.some((t) => t.diagnostico_index === i))
  )
    return 'Cada diagnóstico requiere al menos un tratamiento (máximo 10 diagnósticos y 20 tratamientos).';
  if (
    bundle.tratamientos.some(
      (t) => t.diagnostico_index < 0 || t.diagnostico_index >= bundle.diagnosticos.length,
    )
  )
    return 'Vincule cada tratamiento a un diagnóstico existente.';
  const start = Date.parse(bundle.fecha_hora_inicio);
  if (
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,3})?Z$/.test(bundle.fecha_hora_inicio) ||
    !Number.isFinite(start) ||
    start > Date.parse(now)
  )
    return 'El inicio debe ser una fecha y hora UTC válida, no futura (terminada en Z).';
  if (
    bundle.tratamientos.some((t) => t.fecha_fin_estimada && t.fecha_fin_estimada < t.fecha_inicio)
  )
    return 'El fin estimado no puede ser anterior al inicio del tratamiento.';
  if (bundle.receta) {
    const details = bundle.receta.detalles;
    if (
      !details.length ||
      details.length > 20 ||
      new Set(details.map((d) => d.id_medicamento)).size !== details.length
    )
      return 'La receta requiere de 1 a 20 medicamentos distintos.';
    if (details.some((d) => Math.abs(Math.round(d.cantidad * 100) - d.cantidad * 100) > 1e-8))
      return 'La cantidad admite como máximo dos decimales.';
  }
  return null;
}
export function Consulta({
  patientId,
  catalogs,
  canSubmit,
  onSaved,
  onArchived,
}: {
  patientId: number;
  catalogs: CatalogosDto | null;
  canSubmit: boolean;
  onSaved: () => void;
  onArchived: () => void;
}) {
  const [diagnoses, setDiagnoses] = useState([0]);
  const [primary, setPrimary] = useState(0);
  const [treatments, setTreatments] = useState<TreatmentRow[]>([{ id: 0, diagnosis: 0 }]);
  const [medications, setMedications] = useState([0]);
  const [recipe, setRecipe] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const nextId = useRef(1);
  const pending = useRef(false);
  const [start] = useState(() => new Date().toISOString());
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending.current || !canSubmit) return;
    const bundle = buildConsulta(
      new FormData(event.currentTarget),
      diagnoses,
      treatments,
      medications,
    );
    const validation = bundleError(bundle);
    if (validation) {
      setError(validation);
      return;
    }
    pending.current = true;
    setBusy(true);
    setError('');
    try {
      await api<ConsultaCompleta>(`/api/pacientes/${patientId}/consultas`, {
        method: 'POST',
        body: JSON.stringify(bundle),
      });
      onSaved();
    } catch (e) {
      setError(errorMessage(e));
      if (e instanceof ApiError && e.status === 409 && e.code === 'expediente_archived')
        onArchived();
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }
  return (
    <form onSubmit={submit} aria-label="Consulta clínica">
      <p>
        Paciente {patientId}. Borrador solo en esta ficha: no se guarda parcialmente ni sobrevive a
        recargar o salir del paciente. Guardar cierra toda la consulta en una operación; el servidor
        asigna el cierre.
      </p>
      {!canSubmit && (
        <p role="status">
          Guardado no disponible: verifique carga, permisos, estado del expediente y catálogos. El
          borrador se conserva.
        </p>
      )}
      {catalogs && !catalogs.profesionales.length && (
        <p role="alert">
          No hay profesionales disponibles en el catálogo del servidor. No se puede guardar una
          consulta.
        </p>
      )}
      <fieldset disabled={busy}>
        <legend>Atención</legend>
        <div className="form-grid">
          <label>
            Profesional *
            <select name="id_profesional" required defaultValue="">
              <option value="">Seleccione</option>
              {catalogs?.profesionales.map((p) => (
                <option key={p.id_profesional} value={p.id_profesional}>
                  {p.nombres} {p.apellidos}
                </option>
              ))}
            </select>
          </label>
          <label>
            Inicio UTC (ISO, terminado en Z) *
            <input name="fecha_hora_inicio" required defaultValue={start} />
          </label>
          <label>
            Tipo *
            <select name="tipo">
              <option value="primera_vez">Primera vez</option>
              <option value="seguimiento">Seguimiento</option>
            </select>
          </label>
          <label>
            Motivo de consulta *<textarea name="motivo_consulta" required maxLength={500} />
          </label>
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
      <fieldset disabled={busy}>
        <legend>Diagnósticos (1–10)</legend>
        {diagnoses.map((id, index) => (
          <fieldset key={id}>
            <legend>Diagnóstico {index + 1}</legend>
            <div className="form-grid">
              <label>
                Código CIE-10
                <input name={`d${id}-codigo`} maxLength={10} />
              </label>
              <label>
                Descripción *<textarea name={`d${id}-descripcion`} maxLength={500} required />
              </label>
              <label>
                Tipo *
                <select name={`d${id}-tipo`}>
                  <option value="presuntivo">Presuntivo</option>
                  <option value="definitivo">Definitivo</option>
                </select>
              </label>
              <label className="radio">
                <input
                  name="primary"
                  type="radio"
                  value={id}
                  checked={primary === id}
                  onChange={() => setPrimary(id)}
                  required
                />
                Diagnóstico principal
              </label>
            </div>
            <button
              type="button"
              disabled={diagnoses.length === 1}
              onClick={() => {
                const remaining = diagnoses.filter((d) => d !== id);
                setDiagnoses(remaining);
                setTreatments(treatments.filter((t) => t.diagnosis !== id));
                if (primary === id) setPrimary(remaining[0]!);
              }}
            >
              Quitar diagnóstico {index + 1} y sus tratamientos
            </button>
          </fieldset>
        ))}
        <button
          type="button"
          disabled={diagnoses.length >= 10 || treatments.length >= 20}
          onClick={() => {
            const id = nextId.current++;
            setDiagnoses([...diagnoses, id]);
            setTreatments([...treatments, { id, diagnosis: id }]);
          }}
        >
          Agregar diagnóstico con tratamiento
        </button>
      </fieldset>
      <fieldset disabled={busy}>
        <legend>Tratamientos (1–20; al menos uno por diagnóstico)</legend>
        {treatments.map((row, index) => (
          <fieldset key={row.id}>
            <legend>Tratamiento {index + 1}</legend>
            <div className="form-grid">
              <label>
                Diagnóstico *
                <select
                  value={row.diagnosis}
                  onChange={(e) =>
                    setTreatments(
                      treatments.map((t) =>
                        t.id === row.id ? { ...t, diagnosis: Number(e.target.value) } : t,
                      ),
                    )
                  }
                >
                  {diagnoses.map((id, i) => (
                    <option key={id} value={id}>
                      Diagnóstico {i + 1}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Tipo *
                <select name={`t${row.id}-tipo`}>
                  {['farmacologico', 'procedimiento', 'terapia', 'reposo', 'dieta'].map((t) => (
                    <option key={t} value={t}>
                      {t === 'farmacologico' ? 'Farmacológico' : t}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Descripción *<textarea name={`t${row.id}-descripcion`} maxLength={1000} required />
              </label>
              <label>
                Indicaciones
                <textarea name={`t${row.id}-indicaciones`} maxLength={1000} />
              </label>
              <label>
                Fecha de inicio *
                <input
                  name={`t${row.id}-inicio`}
                  type="date"
                  defaultValue={start.slice(0, 10)}
                  required
                />
              </label>
              <label>
                Fin estimado
                <input name={`t${row.id}-fin`} type="date" />
              </label>
            </div>
            <button
              type="button"
              disabled={treatments.length === 1}
              onClick={() => setTreatments(treatments.filter((t) => t.id !== row.id))}
            >
              Quitar tratamiento {index + 1}
            </button>
          </fieldset>
        ))}
        <button
          type="button"
          disabled={treatments.length >= 20}
          onClick={() =>
            setTreatments([...treatments, { id: nextId.current++, diagnosis: diagnoses[0]! }])
          }
        >
          Agregar tratamiento
        </button>
      </fieldset>
      <label className="radio">
        <input
          type="checkbox"
          name="recipe"
          checked={recipe}
          disabled={busy}
          onChange={(e) => setRecipe(e.target.checked)}
        />
        Incluir receta
      </label>
      <fieldset hidden={!recipe} disabled={!recipe || busy}>
        <legend>Receta (1–20 medicamentos distintos)</legend>
        {catalogs && !catalogs.medicamentos.length && (
          <p role="alert">
            No hay medicamentos disponibles. No se inventan opciones; puede guardar sin receta.
          </p>
        )}
        <label>
          Observaciones
          <textarea name="receta-observaciones" maxLength={1000} />
        </label>
        {medications.map((id, index) => (
          <fieldset key={id}>
            <legend>Medicamento {index + 1}</legend>
            <div className="form-grid">
              <label>
                Medicamento *
                <select name={`m${id}-id`} required defaultValue="">
                  <option value="">Seleccione</option>
                  {catalogs?.medicamentos.map((m) => (
                    <option key={m.id_medicamento} value={m.id_medicamento}>
                      {m.nombre_generico}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Dosis *<input name={`m${id}-dosis`} maxLength={100} required />
              </label>
              <label>
                Vía de administración *<input name={`m${id}-via`} maxLength={50} required />
              </label>
              <label>
                Frecuencia (horas) *
                <input
                  name={`m${id}-frecuencia`}
                  type="number"
                  min={1}
                  max={168}
                  step={1}
                  required
                />
              </label>
              <label>
                Duración (días) *
                <input name={`m${id}-duracion`} type="number" min={1} max={365} step={1} required />
              </label>
              <label>
                Cantidad *
                <input
                  name={`m${id}-cantidad`}
                  type="number"
                  min={0.01}
                  max={999999.99}
                  step={0.01}
                  required
                />
              </label>
              <label>
                Indicaciones
                <textarea name={`m${id}-indicaciones`} maxLength={1000} />
              </label>
            </div>
            <button
              type="button"
              disabled={medications.length === 1}
              onClick={() => setMedications(medications.filter((m) => m !== id))}
            >
              Quitar medicamento {index + 1}
            </button>
          </fieldset>
        ))}
        <button
          type="button"
          disabled={medications.length >= 20}
          onClick={() => setMedications([...medications, nextId.current++])}
        >
          Agregar medicamento
        </button>
      </fieldset>
      {error && (
        <p role="alert" className="error">
          {error} El formulario conserva su contenido.
        </p>
      )}
      <button
        data-testid="consulta-submit"
        disabled={
          busy ||
          !canSubmit ||
          !catalogs?.profesionales.length ||
          (recipe && !catalogs.medicamentos.length)
        }
      >
        {busy ? 'Guardando…' : 'Guardar consulta completa y cerrar'}
      </button>
    </form>
  );
}

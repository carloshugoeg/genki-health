import { useState, type FormEvent, type ReactNode } from 'react';
import type { AuthPrincipalDto } from '@genki/shared';
import { api, errorMessage } from '../api';
import { EntitySelect } from '../components/EntitySelect';
import { canAccess } from './clinicalAccess';
import { HospitalizacionPanel } from './HospitalizacionPanel';
import { idempotencyKey, type DiagnosticoRef } from './specialtyShared';

type Outcome = { label: string; rows?: unknown[]; detail?: string };

function useRunner() {
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  async function run(fn: () => Promise<Outcome>) {
    setBusy(true);
    setError('');
    setOutcome(null);
    try {
      setOutcome(await fn());
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  return { outcome, error, busy, run, setError };
}

function rowsOf(result: unknown): unknown[] {
  if (Array.isArray(result)) return result;
  if (
    result &&
    typeof result === 'object' &&
    Array.isArray((result as { items?: unknown }).items)
  ) {
    return (result as { items: unknown[] }).items;
  }
  return [];
}

function rowText(row: unknown, depth = 0): string {
  if (!row || typeof row !== 'object') return String(row);
  return Object.entries(row as Record<string, unknown>)
    .filter(([, v]) => v !== null && v !== undefined && v !== '')
    .map(([k, v]) => {
      const name = k.replace(/_/g, ' ');
      if (Array.isArray(v)) return `${name}: ${v.length}`;
      if (typeof v === 'object') return depth ? '' : rowText(v, depth + 1);
      return `${name}: ${typeof v === 'boolean' ? (v ? 'sí' : 'no') : String(v)}`;
    })
    .filter(Boolean)
    .join(' · ');
}

function Feedback({ outcome, error }: { outcome: Outcome | null; error: string }) {
  return (
    <>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {outcome && (
        <div role="status" className="notice">
          <p>
            {outcome.label}
            {outcome.detail ? `: ${outcome.detail}` : ''}
          </p>
          {outcome.rows &&
            (outcome.rows.length ? (
              <ul className="specialty-results">
                {outcome.rows.map((row, i) => (
                  <li key={i}>{rowText(row)}</li>
                ))}
              </ul>
            ) : (
              <p className="muted">Sin registros.</p>
            ))}
        </div>
      )}
    </>
  );
}

function NoAccess({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <h3>{title}</h3>
      <p className="muted">{children}</p>
    </section>
  );
}

function optionalNumber(data: FormData, key: string): number | undefined {
  const raw = String(data.get(key) ?? '').trim();
  if (!raw) return undefined;
  const n = Number(raw);
  return Number.isFinite(n) ? n : undefined;
}

function PediatriaPanel({ patientId }: { patientId: number }) {
  const { outcome, error, busy, run, setError } = useRunner();

  function submitPerinatal(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const body: Record<string, unknown> = {};
    for (const key of [
      'semanas_gestacion',
      'peso_nacimiento_g',
      'talla_nacimiento_cm',
      'apgar_1min',
      'apgar_5min',
    ]) {
      const n = optionalNumber(data, key);
      if (n !== undefined) body[key] = n;
    }
    const tipo = String(data.get('tipo_parto') ?? '');
    if (tipo) body.tipo_parto = tipo;
    const comp = String(data.get('complicaciones') ?? '').trim();
    if (comp) body.complicaciones = comp;
    if (!Object.keys(body).length) {
      setError('Complete al menos un dato perinatal.');
      return;
    }
    void run(async () => {
      await api(`/api/pacientes/${patientId}/perinatal`, {
        method: 'PUT',
        headers: { 'Idempotency-Key': idempotencyKey('perinatal') },
        body: JSON.stringify(body),
      });
      return { label: 'Antecedente perinatal guardado' };
    });
  }

  function submitHito(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const hito = optionalNumber(data, 'id_hito');
    const fecha = String(data.get('fecha_evaluacion') ?? '');
    if (!hito || !Number.isInteger(hito) || hito < 1 || !fecha) {
      setError('Indique el número de hito y la fecha de evaluación.');
      return;
    }
    const observacion = String(data.get('observacion') ?? '').trim();
    void run(async () => {
      await api(`/api/pacientes/${patientId}/hitos/${hito}`, {
        method: 'PUT',
        headers: { 'Idempotency-Key': idempotencyKey('hito') },
        body: JSON.stringify({
          alcanzado: data.get('alcanzado') === 'on',
          fecha_evaluacion: fecha,
          ...(observacion ? { observacion } : {}),
        }),
      });
      return { label: `Hito ${hito} evaluado` };
    });
  }

  return (
    <section data-testid="pediatria-panel">
      <h3>Pediatría</h3>
      <p className="notice">
        Curva de crecimiento sin percentiles OMS (tablas WHO no cargadas en este MVP).
      </p>
      <Feedback outcome={outcome} error={error} />
      <div className="actions">
        <button
          type="button"
          disabled={busy}
          onClick={() =>
            void run(async () => {
              const rows = rowsOf(await api(`/api/pacientes/${patientId}/crecimiento`));
              return { label: 'Curva de crecimiento', detail: `${rows.length} mediciones`, rows };
            })
          }
        >
          Ver curva
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() =>
            void run(async () => {
              const rows = rowsOf(await api(`/api/pacientes/${patientId}/vacunas`));
              return { label: 'Esquema de vacunas', detail: `${rows.length} dosis`, rows };
            })
          }
        >
          Esquema vacunas
        </button>
      </div>
      <form className="specialty-form" onSubmit={submitPerinatal}>
        <h4>Antecedente perinatal</h4>
        <label>
          Semanas de gestación
          <input name="semanas_gestacion" type="number" min={20} max={45} disabled={busy} />
        </label>
        <label>
          Tipo de parto
          <select name="tipo_parto" defaultValue="" disabled={busy}>
            <option value="">Sin especificar</option>
            <option value="vaginal">Vaginal</option>
            <option value="cesarea">Cesárea</option>
          </select>
        </label>
        <label>
          Peso al nacer (g)
          <input name="peso_nacimiento_g" type="number" min={200} max={7000} disabled={busy} />
        </label>
        <label>
          Talla al nacer (cm)
          <input
            name="talla_nacimiento_cm"
            type="number"
            min={20}
            max={70}
            step="0.1"
            disabled={busy}
          />
        </label>
        <label>
          APGAR 1 min
          <input name="apgar_1min" type="number" min={0} max={10} disabled={busy} />
        </label>
        <label>
          APGAR 5 min
          <input name="apgar_5min" type="number" min={0} max={10} disabled={busy} />
        </label>
        <label>
          Complicaciones
          <input name="complicaciones" disabled={busy} />
        </label>
        <button type="submit" disabled={busy}>
          Guardar perinatal
        </button>
      </form>
      <form className="specialty-form" onSubmit={submitHito}>
        <h4>Evaluar hito del desarrollo</h4>
        <label>
          N.º de hito (catálogo de la institución)
          <input name="id_hito" type="number" min={1} required disabled={busy} />
        </label>
        <label>
          Fecha de evaluación
          <input
            name="fecha_evaluacion"
            type="date"
            required
            defaultValue={new Date().toISOString().slice(0, 10)}
            disabled={busy}
          />
        </label>
        <label>
          <input name="alcanzado" type="checkbox" disabled={busy} /> Alcanzado
        </label>
        <label>
          Observación
          <input name="observacion" disabled={busy} />
        </label>
        <button type="submit" disabled={busy}>
          Evaluar hito
        </button>
      </form>
    </section>
  );
}

function LaboratorioPanel({
  patientId,
  principal,
}: {
  patientId: number;
  principal: AuthPrincipalDto;
}) {
  const { outcome, error, busy, run, setError } = useRunner();
  const canOrden = canAccess(principal.roles, 'ordenLaboratorio');
  const canHistorial = canAccess(principal.roles, 'historialExamenes');

  function submitOrden(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const examenes = String(data.get('examenes') ?? '')
      .split(/[,\s]+/)
      .map((code) => code.trim().toUpperCase())
      .filter(Boolean);
    const medico = String(data.get('medico_solicitante') ?? '').trim();
    if (!examenes.length || !medico) {
      setError('Indique al menos un código de examen y el médico solicitante.');
      return;
    }
    const observaciones = String(data.get('observaciones') ?? '').trim();
    void run(async () => {
      const result = await api<{ id_orden?: number } | undefined>('/api/laboratorio/ordenes', {
        method: 'POST',
        headers: { 'Idempotency-Key': idempotencyKey('orden-lab') },
        body: JSON.stringify({
          id_paciente: patientId,
          institucion_origen: principal.id_institucion,
          medico_solicitante: medico,
          prioridad: String(data.get('prioridad') ?? 'rutina'),
          examenes,
          ...(observaciones ? { observaciones } : {}),
        }),
      });
      form.reset();
      return {
        label: 'Orden recibida',
        ...(result?.id_orden ? { detail: `orden #${result.id_orden}` } : {}),
      };
    });
  }

  if (!canOrden && !canHistorial) {
    return (
      <NoAccess title="Laboratorio">
        Su rol no tiene acceso a órdenes ni resultados de laboratorio.
      </NoAccess>
    );
  }

  return (
    <section data-testid="laboratorio-panel">
      <h3>Laboratorio</h3>
      <Feedback outcome={outcome} error={error} />
      {canHistorial && (
        <div className="actions">
          <button
            type="button"
            disabled={busy}
            onClick={() =>
              void run(async () => {
                const rows = rowsOf(await api(`/api/pacientes/${patientId}/examenes`));
                return { label: 'Historial de exámenes', detail: `${rows.length} registros`, rows };
              })
            }
          >
            Historial exámenes
          </button>
        </div>
      )}
      {canOrden && (
        <form className="specialty-form" onSubmit={submitOrden}>
          <h4>Recibir orden</h4>
          <label>
            Códigos de examen (separados por coma)
            <input name="examenes" required placeholder="Ej.: HEM001" disabled={busy} />
          </label>
          <label>
            Médico solicitante
            <input name="medico_solicitante" required disabled={busy} />
          </label>
          <label>
            Prioridad
            <select name="prioridad" defaultValue="rutina" disabled={busy}>
              <option value="rutina">Rutina</option>
              <option value="urgente">Urgente</option>
            </select>
          </label>
          <label>
            Observaciones
            <input name="observaciones" disabled={busy} />
          </label>
          <button type="submit" disabled={busy}>
            Recibir orden
          </button>
        </form>
      )}
    </section>
  );
}

function OdontologiaPanel({ patientId }: { patientId: number }) {
  const { outcome, error, busy, run, setError } = useRunner();
  const [profesional, setProfesional] = useState<number | ''>('');

  function submitPlan(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const pieza = optionalNumber(data, 'numero_pieza');
    const codigo = String(data.get('codigo_procedimiento') ?? '').trim();
    const precio = optionalNumber(data, 'precio_unitario');
    if (profesional === '' || !pieza || !codigo || precio === undefined || precio < 0) {
      setError('Indique profesional, pieza, procedimiento y precio.');
      return;
    }
    void run(async () => {
      const result = await api<{ id_plan?: number }>(`/api/pacientes/${patientId}/planes`, {
        method: 'POST',
        headers: { 'Idempotency-Key': idempotencyKey('plan') },
        body: JSON.stringify({
          id_profesional: profesional,
          detalle: [
            {
              linea: 1,
              numero_pieza: pieza,
              codigo_procedimiento: codigo,
              orden: 1,
              precio_unitario: precio.toFixed(2),
            },
          ],
        }),
      });
      form.reset();
      return {
        label: 'Plan de tratamiento elaborado',
        ...(result?.id_plan ? { detail: `plan #${result.id_plan}` } : {}),
      };
    });
  }

  return (
    <section data-testid="odontologia-panel">
      <h3>Odontología</h3>
      <Feedback outcome={outcome} error={error} />
      <label>
        Profesional
        <EntitySelect
          kind="profesional"
          name="id_profesional"
          value={profesional}
          onChange={setProfesional}
          required
          disabled={busy}
        />
      </label>
      <div className="actions">
        <button
          type="button"
          disabled={busy || profesional === ''}
          onClick={() =>
            void run(async () => {
              const result = await api<{ id_odontograma?: number }>(
                `/api/pacientes/${patientId}/odontogramas`,
                {
                  method: 'POST',
                  headers: { 'Idempotency-Key': idempotencyKey('odontograma') },
                  body: JSON.stringify({ id_profesional: profesional }),
                },
              );
              return {
                label: 'Odontograma abierto',
                ...(result?.id_odontograma ? { detail: `#${result.id_odontograma}` } : {}),
              };
            })
          }
        >
          Abrir odontograma
        </button>
      </div>
      <form className="specialty-form" onSubmit={submitPlan}>
        <h4>Elaborar plan (una línea)</h4>
        <label>
          Pieza (FDI)
          <input name="numero_pieza" type="number" min={11} max={85} required disabled={busy} />
        </label>
        <label>
          Código de procedimiento
          <input name="codigo_procedimiento" required disabled={busy} />
        </label>
        <label>
          Precio unitario (Q)
          <input
            name="precio_unitario"
            type="number"
            min={0}
            step="0.01"
            required
            disabled={busy}
          />
        </label>
        <button type="submit" disabled={busy || profesional === ''}>
          Elaborar plan
        </button>
      </form>
    </section>
  );
}

export function SpecialtyPanels({
  patientId,
  principal,
  diagnosticos = [],
  archived = false,
}: {
  patientId: number;
  principal: AuthPrincipalDto;
  diagnosticos?: DiagnosticoRef[];
  archived?: boolean;
}) {
  const kind = principal.institution_kind;
  const roles = principal.roles;

  if (kind === 'hospital_general') {
    return (
      <HospitalizacionPanel
        patientId={patientId}
        institucion={principal.id_institucion}
        roles={roles}
        diagnosticos={diagnosticos}
        archived={archived}
      />
    );
  }
  if (kind === 'centro_pediatrico') {
    return canAccess(roles, 'pediatria') ? <PediatriaPanel patientId={patientId} /> : null;
  }
  if (kind === 'laboratorio_clinico') {
    return <LaboratorioPanel patientId={patientId} principal={principal} />;
  }
  if (kind === 'clinica_odontologica') {
    return canAccess(roles, 'odontologia') ? <OdontologiaPanel patientId={patientId} /> : null;
  }
  return null;
}

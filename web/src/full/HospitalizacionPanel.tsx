import { useEffect, useState, type FormEvent } from 'react';
import type { ADMISION, CAMA } from '@genki/shared/full/admission';
import { ApiError, api, errorMessage } from '../api';
import { canAccess } from './clinicalAccess';
import {
  diagnosticoLabel,
  idempotencyKey,
  localDateTimeValue,
  readLocal,
  toIsoZ,
  writeLocal,
  type DiagnosticoRef,
} from './specialtyShared';

type ActiveAdmission = {
  id_admision: number;
  id_cama: number | null;
  codigo_cama: string | null;
  fecha_hora_ingreso: string | null;
};

const TIPOS_INGRESO = [
  ['emergencia', 'Emergencia'],
  ['electiva', 'Electiva'],
  ['traslado', 'Traslado'],
] as const;
const CONDICIONES_EGRESO = [
  ['mejorado', 'Mejorado'],
  ['igual', 'Igual'],
  ['empeorado', 'Empeorado'],
  ['traslado', 'Traslado'],
  ['fallecido', 'Fallecido'],
] as const;

function displayTime(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : new Intl.DateTimeFormat('es-GT', {
        dateStyle: 'medium',
        timeStyle: 'short',
        timeZone: 'America/Guatemala',
      }).format(date);
}

export function HospitalizacionPanel({
  patientId,
  institucion,
  roles,
  diagnosticos,
  archived,
}: {
  patientId: number;
  institucion: number;
  roles: readonly string[];
  diagnosticos: DiagnosticoRef[];
  archived: boolean;
}) {
  const storeKey = `genki.admision_activa.${institucion}.${patientId}`;
  const canIngreso = canAccess(roles, 'ingreso');
  const canNota = canAccess(roles, 'nota');
  const canEgreso = canAccess(roles, 'egreso');

  const [active, setActive] = useState<ActiveAdmission | null>(() =>
    readLocal<ActiveAdmission>(storeKey),
  );
  const [camas, setCamas] = useState<CAMA[] | null>(null);
  const [camasError, setCamasError] = useState('');
  const [camasReload, setCamasReload] = useState(0);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);

  const [cama, setCama] = useState<number | ''>('');
  const [dxIngreso, setDxIngreso] = useState<number | ''>('');
  const [tipoIngreso, setTipoIngreso] = useState<string>('emergencia');
  const [fechaIngreso, setFechaIngreso] = useState(() => localDateTimeValue());

  const [manualId, setManualId] = useState('');

  const [contenido, setContenido] = useState('');
  const [turno, setTurno] = useState<'diurno' | 'nocturno'>('diurno');

  const [dxEgreso, setDxEgreso] = useState<number | ''>('');
  const [condicion, setCondicion] = useState<string>('mejorado');
  const [fechaEgreso, setFechaEgreso] = useState(() => localDateTimeValue());

  useEffect(() => setActive(readLocal<ActiveAdmission>(storeKey)), [storeKey]);

  // El egreso debe ser posterior al ingreso; proponer el primer minuto válido.
  useEffect(() => {
    const ingreso = active?.fecha_hora_ingreso ? Date.parse(active.fecha_hora_ingreso) : NaN;
    const earliest = Number.isNaN(ingreso) ? Date.now() : Math.max(Date.now(), ingreso + 60_000);
    setFechaEgreso(localDateTimeValue(new Date(earliest)));
  }, [active?.id_admision, active?.fecha_hora_ingreso]);

  useEffect(() => {
    if (!canIngreso) return;
    let live = true;
    setCamasError('');
    void api<CAMA[]>('/api/camas')
      .then((rows) => {
        if (live) setCamas(rows);
      })
      .catch((e) => {
        if (live) setCamasError(errorMessage(e));
      });
    return () => {
      live = false;
    };
  }, [canIngreso, camasReload]);

  function remember(next: ActiveAdmission | null) {
    setActive(next);
    writeLocal(storeKey, next);
  }

  async function run(fn: () => Promise<void>, onConflict?: string) {
    setBusy(true);
    setError('');
    setStatus('');
    try {
      await fn();
    } catch (e) {
      setError(
        onConflict && e instanceof ApiError && e.code === 'conflict' ? onConflict : errorMessage(e),
      );
    } finally {
      setBusy(false);
    }
  }

  function submitIngreso(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const fecha = toIsoZ(fechaIngreso);
    if (cama === '' || dxIngreso === '' || !fecha) {
      setError('Seleccione cama, diagnóstico de ingreso y fecha/hora.');
      return;
    }
    void run(async () => {
      const result = await api<ADMISION>(`/api/pacientes/${patientId}/admisiones`, {
        method: 'POST',
        headers: { 'Idempotency-Key': idempotencyKey('ingreso') },
        body: JSON.stringify({
          id_cama: cama,
          id_diagnostico_ingreso: dxIngreso,
          tipo_ingreso: tipoIngreso,
          fecha_hora_ingreso: fecha,
        }),
      });
      const bed = camas?.find((row) => row.id_cama === result.id_cama);
      remember({
        id_admision: result.id_admision,
        id_cama: result.id_cama,
        codigo_cama: bed?.codigo ?? null,
        fecha_hora_ingreso: result.fecha_hora_ingreso,
      });
      setStatus(
        `Ingreso registrado: admisión #${result.id_admision}${bed ? `, cama ${bed.codigo}` : ''}.`,
      );
      setCama('');
      setCamasReload((n) => n + 1);
    }, 'No se pudo registrar el ingreso: el paciente ya tiene una admisión activa o la cama dejó de estar libre. Si ya tiene una admisión activa, indique su número en «N.º de admisión»; si no, recargue las camas.');
  }

  function submitNota(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!active) return;
    if (!contenido.trim()) {
      setError('Escriba el contenido de la nota.');
      return;
    }
    void run(async () => {
      await api(`/api/admisiones/${active.id_admision}/notas`, {
        method: 'POST',
        headers: { 'Idempotency-Key': idempotencyKey('nota') },
        body: JSON.stringify({ contenido: contenido.trim(), turno }),
      });
      setContenido('');
      setStatus(`Nota de evolución registrada en la admisión #${active.id_admision}.`);
    });
  }

  function submitEgreso(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!active) return;
    const fecha = toIsoZ(fechaEgreso);
    if (dxEgreso === '' || !fecha) {
      setError('Seleccione diagnóstico de egreso y fecha/hora.');
      return;
    }
    if (active.fecha_hora_ingreso && Date.parse(fecha) <= Date.parse(active.fecha_hora_ingreso)) {
      setError('La fecha y hora de egreso debe ser posterior al ingreso.');
      return;
    }
    void run(async () => {
      await api(`/api/admisiones/${active.id_admision}/egreso`, {
        method: 'POST',
        headers: { 'Idempotency-Key': idempotencyKey('egreso') },
        body: JSON.stringify({
          id_diagnostico_egreso: dxEgreso,
          condicion_egreso: condicion,
          fecha_hora_egreso: fecha,
        }),
      });
      setStatus(`Egreso registrado para la admisión #${active.id_admision}.`);
      remember(null);
      setDxEgreso('');
      setCamasReload((n) => n + 1);
    }, 'No se pudo registrar el egreso: la admisión ya no está activa o la fecha de egreso no es posterior al ingreso.');
  }

  function adoptManual(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const id = Number(manualId);
    if (!Number.isInteger(id) || id < 1) {
      setError('Ingrese un número de admisión válido.');
      return;
    }
    setError('');
    remember({ id_admision: id, id_cama: null, codigo_cama: null, fecha_hora_ingreso: null });
    setManualId('');
  }

  if (!canIngreso && !canNota && !canEgreso) return null;

  const noDx = diagnosticos.length === 0;
  const dxOptions = diagnosticos.map((d) => (
    <option key={d.id_diagnostico} value={d.id_diagnostico}>
      {diagnosticoLabel(d)}
    </option>
  ));

  return (
    <section data-testid="hospitalizacion-panel">
      <h3>Hospitalización</h3>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {status && (
        <p className="notice" role="status">
          {status}
        </p>
      )}

      <h4>Admisión activa</h4>
      {active ? (
        <p data-testid="admision-activa">
          Admisión #{active.id_admision}
          {active.codigo_cama ? ` · cama ${active.codigo_cama}` : ''}
          {active.fecha_hora_ingreso
            ? ` · ingreso ${displayTime(active.fecha_hora_ingreso)}`
            : ''}{' '}
          <button type="button" disabled={busy} onClick={() => remember(null)}>
            Cambiar admisión
          </button>
        </p>
      ) : (
        <>
          <p className="muted">
            Sin admisión activa registrada desde este navegador. El servidor aún no permite
            consultar las admisiones del paciente; si el ingreso se registró en otro equipo, indique
            su número.
          </p>
          {(canNota || canEgreso) && (
            <form className="inline-form" onSubmit={adoptManual}>
              <label>
                N.º de admisión
                <input
                  type="number"
                  min={1}
                  inputMode="numeric"
                  value={manualId}
                  onChange={(e) => setManualId(e.target.value)}
                />
              </label>
              <button type="submit" disabled={busy || !manualId}>
                Usar esta admisión
              </button>
            </form>
          )}
        </>
      )}

      {canIngreso && !active && (
        <form className="specialty-form" onSubmit={submitIngreso} data-testid="ingreso-form">
          <h4>Registrar ingreso</h4>
          {archived && <p className="notice">El expediente está archivado.</p>}
          {noDx && (
            <p className="notice">
              El paciente no tiene diagnósticos registrados. Cierre una consulta con diagnóstico
              antes de registrar el ingreso.
            </p>
          )}
          {camasError && (
            <p className="error" role="alert">
              Camas: {camasError}{' '}
              <button type="button" onClick={() => setCamasReload((n) => n + 1)}>
                Reintentar
              </button>
            </p>
          )}
          <label>
            Cama disponible
            <select
              name="id_cama"
              required
              value={cama === '' ? '' : String(cama)}
              disabled={busy || !camas}
              onChange={(e) => setCama(e.target.value === '' ? '' : Number(e.target.value))}
            >
              <option value="">
                {!camas ? 'Cargando camas…' : camas.length ? 'Seleccione' : 'No hay camas libres'}
              </option>
              {(camas ?? []).map((row) => (
                <option key={row.id_cama} value={row.id_cama}>
                  {row.codigo} · {row.tipo_cama} · {row.codigo_servicio}
                </option>
              ))}
            </select>
          </label>
          <label>
            Diagnóstico de ingreso
            <select
              name="id_diagnostico_ingreso"
              required
              value={dxIngreso === '' ? '' : String(dxIngreso)}
              disabled={busy || noDx}
              onChange={(e) => setDxIngreso(e.target.value === '' ? '' : Number(e.target.value))}
            >
              <option value="">Seleccione</option>
              {dxOptions}
            </select>
          </label>
          <label>
            Tipo de ingreso
            <select
              name="tipo_ingreso"
              value={tipoIngreso}
              disabled={busy}
              onChange={(e) => setTipoIngreso(e.target.value)}
            >
              {TIPOS_INGRESO.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label>
            Fecha y hora de ingreso
            <input
              type="datetime-local"
              required
              value={fechaIngreso}
              disabled={busy}
              onChange={(e) => setFechaIngreso(e.target.value)}
            />
          </label>
          <button
            type="submit"
            disabled={busy || archived || noDx || cama === '' || dxIngreso === ''}
          >
            Registrar ingreso
          </button>
        </form>
      )}

      {active && canNota && (
        <form className="specialty-form" onSubmit={submitNota} data-testid="nota-form">
          <h4>Nota de evolución</h4>
          <label>
            Contenido
            <textarea
              required
              maxLength={10000}
              value={contenido}
              disabled={busy}
              onChange={(e) => setContenido(e.target.value)}
            />
          </label>
          <label>
            Turno
            <select
              value={turno}
              disabled={busy}
              onChange={(e) => setTurno(e.target.value as 'diurno' | 'nocturno')}
            >
              <option value="diurno">Diurno</option>
              <option value="nocturno">Nocturno</option>
            </select>
          </label>
          <button type="submit" disabled={busy || !contenido.trim()}>
            Escribir nota
          </button>
        </form>
      )}

      {active && canEgreso && (
        <form className="specialty-form" onSubmit={submitEgreso} data-testid="egreso-form">
          <h4>Registrar egreso</h4>
          <label>
            Diagnóstico de egreso
            <select
              required
              value={dxEgreso === '' ? '' : String(dxEgreso)}
              disabled={busy || noDx}
              onChange={(e) => setDxEgreso(e.target.value === '' ? '' : Number(e.target.value))}
            >
              <option value="">Seleccione</option>
              {dxOptions}
            </select>
          </label>
          <label>
            Condición de egreso
            <select
              value={condicion}
              disabled={busy}
              onChange={(e) => setCondicion(e.target.value)}
            >
              {CONDICIONES_EGRESO.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label>
            Fecha y hora de egreso
            <input
              type="datetime-local"
              required
              value={fechaEgreso}
              disabled={busy}
              onChange={(e) => setFechaEgreso(e.target.value)}
            />
          </label>
          <button type="submit" disabled={busy || dxEgreso === ''}>
            Registrar egreso
          </button>
        </form>
      )}
    </section>
  );
}

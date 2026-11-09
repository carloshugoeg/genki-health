import { useCallback, useEffect, useState, type FormEvent } from 'react';
import type { CITA, CITAInput, Slot } from '@genki/shared/full/agenda';
import { EntitySelect, entityLabel, loadEntityDirectory } from '../../components/EntitySelect';
import './agenda.css';

/** Host supplies the existing authenticated client; no auth or router wiring. */
export interface AgendaProps {
  request: <T>(path: string, init?: RequestInit) => Promise<T>;
}
const today = () =>
  new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Guatemala',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
const localInput = (iso: string) =>
  new Date(Date.parse(iso) - 6 * 3600000).toISOString().slice(0, 16);
const utc = (local: string) => new Date(`${local}:00-06:00`).toISOString();
const display = (iso: string) =>
  new Intl.DateTimeFormat('es-GT', {
    timeZone: 'America/Guatemala',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(iso));
export function Agenda({ request }: AgendaProps) {
  const [day, setDay] = useState(today),
    [professional, setProfessional] = useState<number | ''>('');
  const [rows, setRows] = useState<CITA[]>([]),
    [slots, setSlots] = useState<Slot[] | null>(null);
  const [selected, setSelected] = useState<CITA | null>(null),
    [time, setTime] = useState(''),
    [duration, setDuration] = useState(30),
    [reason, setReason] = useState('');
  const [error, setError] = useState(''),
    [notice, setNotice] = useState(''),
    [busy, setBusy] = useState(false);
  const [, setNamesReady] = useState(false);
  const [patient, setPatient] = useState<number | ''>(''),
    [bookProfessional, setBookProfessional] = useState<number | ''>(''),
    [bookTime, setBookTime] = useState(''),
    [bookDuration, setBookDuration] = useState(30),
    [motive, setMotive] = useState('');
  const load = useCallback(async () => {
    const query = new URLSearchParams({
      fecha: day,
      ...(professional !== '' ? { id_profesional: String(professional) } : {}),
    });
    setRows(await request<CITA[]>(`/api/agenda?${query}`));
  }, [request, day, professional]);
  useEffect(() => {
    void loadEntityDirectory()
      .then(() => setNamesReady(true))
      .catch(() => undefined);
  }, []);
  useEffect(() => {
    let active = true;
    setError('');
    setSlots(null);
    setSelected(null);
    const query = new URLSearchParams({
      fecha: day,
      ...(professional !== '' ? { id_profesional: String(professional) } : {}),
    });
    request<CITA[]>(`/api/agenda?${query}`)
      .then((data) => {
        if (active) setRows(data);
      })
      .catch((e) => {
        if (active) {
          setRows([]);
          setError(e instanceof Error ? e.message : 'No se pudo cargar la agenda');
        }
      });
    return () => {
      active = false;
    };
  }, [request, day, professional]);
  async function act(action: () => Promise<unknown>, message: string, clearSlots = true) {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await action();
      await load();
      setSelected(null);
      if (clearSlots) setSlots(null);
      setNotice(message);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo completar la operación');
    } finally {
      setBusy(false);
    }
  }
  const post = (path: string, body?: unknown) =>
    request<CITA>(path, {
      method: 'POST',
      ...(body !== undefined
        ? { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }
        : {}),
    });
  function book(event: FormEvent) {
    event.preventDefault();
    void act(() => {
      const input: CITAInput = {
        id_paciente: Number(patient),
        id_profesional: Number(bookProfessional),
        fecha_hora: utc(bookTime),
        duracion_minutos: bookDuration,
        motivo: motive,
      };
      return post('/api/citas', input);
    }, 'Cita agendada');
  }
  function choose(cita: CITA) {
    setSelected(cita);
    setTime(localInput(cita.fecha_hora));
    setDuration(cita.duracion_minutos);
    setReason('');
    setNotice('');
  }
  async function availability() {
    await act(
      async () => {
        setSlots(
          await request<Slot[]>(
            `/api/agenda/disponibilidad?${new URLSearchParams({ id_profesional: String(professional), desde: `${day}T06:00:00Z`, hasta: new Date(Date.parse(`${day}T06:00:00Z`) + 86400000).toISOString() })}`,
          ),
        );
      },
      'Disponibilidad consultada',
      false,
    );
  }
  return (
    <section className="genki-agenda" aria-label="Agenda de citas">
      <header>
        <p className="agenda-eyebrow">GENKI · AGENDA</p>
        <h1>Tu día, organizado</h1>
        <p>Horarios de Guatemala · UTC−6</p>
      </header>
      <div className="agenda-filters">
        <label>
          Día
          <input
            type="date"
            required
            value={day}
            disabled={busy}
            onChange={(e) => setDay(e.target.value)}
          />
        </label>
        <label>
          Profesional (opcional)
          <EntitySelect
            kind="profesional"
            name="id_profesional"
            value={professional}
            onChange={setProfessional}
            optional
            disabled={busy}
          />
        </label>
        <button disabled={busy || professional === '' || !day} onClick={() => void availability()}>
          Consultar disponibilidad
        </button>
      </div>
      {error && (
        <p role="alert" className="agenda-error">
          {error}
        </p>
      )}
      {notice && <p role="status">{notice}</p>}
      {slots !== null && (
        <p>
          Disponibilidad:{' '}
          {slots.length
            ? slots.map((slot) => display(slot.inicio)).join(' · ')
            : 'Sin intervalos libres'}
        </p>
      )}
      <div className="agenda-columns">
        <div>
          <h2>
            Agenda del día <small>{rows.length} citas</small>
          </h2>
          {rows.length === 0 ? (
            <p>No hay citas para este día.</p>
          ) : (
            <ul className="agenda-list">
              {rows.map((cita) => (
                <li key={cita.id_cita}>
                  <time>{display(cita.fecha_hora)}</time>
                  <div>
                    <strong>{entityLabel('paciente', cita.id_paciente)}</strong>
                    <p>
                      {entityLabel('profesional', cita.id_profesional)} · {cita.duracion_minutos}{' '}
                      min
                    </p>
                    {cita.motivo && <p>{cita.motivo}</p>}
                    <span>{cita.estado}</span>
                  </div>
                  <button disabled={busy} onClick={() => choose(cita)}>
                    Gestionar
                  </button>
                </li>
              ))}
            </ul>
          )}
          {selected && (
            <form
              className="agenda-card"
              onSubmit={(event) => {
                event.preventDefault();
                void act(
                  () =>
                    post(`/api/citas/${selected.id_cita}/reprogramacion`, {
                      fecha_hora: utc(time),
                      duracion_minutos: duration,
                    }),
                  'Cita reprogramada',
                );
              }}
            >
              <h2>Gestionar cita</h2>
              <label>
                Fecha y hora
                <input
                  type="datetime-local"
                  required
                  value={time}
                  onChange={(e) => setTime(e.target.value)}
                />
              </label>
              <label>
                Duración (minutos)
                <input
                  type="number"
                  min="1"
                  required
                  value={duration}
                  onChange={(e) => setDuration(Number(e.target.value))}
                />
              </label>
              <div className="agenda-actions">
                <button disabled={busy || ['cancelada', 'no_asistio'].includes(selected.estado)}>
                  Reprogramar
                </button>
                <button
                  type="button"
                  disabled={busy || !['programada', 'confirmada'].includes(selected.estado)}
                  onClick={() =>
                    void act(
                      () => post(`/api/citas/${selected.id_cita}/llegada`),
                      'Llegada confirmada',
                    )
                  }
                >
                  Registrar llegada
                </button>
              </div>
              <label>
                Motivo de cancelación
                <input
                  value={reason}
                  maxLength={4000}
                  onChange={(e) => setReason(e.target.value)}
                />
              </label>
              <button
                className="agenda-cancel"
                type="button"
                disabled={
                  busy || !reason.trim() || ['cancelada', 'no_asistio'].includes(selected.estado)
                }
                onClick={() =>
                  void act(
                    () => post(`/api/citas/${selected.id_cita}/cancelacion`, { motivo: reason }),
                    'Cita cancelada',
                  )
                }
              >
                Cancelar cita
              </button>
            </form>
          )}
        </div>
        <form className="agenda-card" onSubmit={book}>
          <h2>Agendar cita</h2>
          <label>
            Paciente
            <EntitySelect
              kind="paciente"
              name="id_paciente"
              value={patient}
              onChange={setPatient}
              required
              disabled={busy}
            />
          </label>
          <label>
            Profesional
            <EntitySelect
              kind="profesional"
              name="id_profesional_cita"
              value={bookProfessional}
              onChange={setBookProfessional}
              required
              disabled={busy}
            />
          </label>
          <label>
            Fecha y hora
            <input
              type="datetime-local"
              required
              value={bookTime}
              onChange={(e) => setBookTime(e.target.value)}
            />
          </label>
          <label>
            Duración (minutos)
            <input
              type="number"
              min="1"
              required
              value={bookDuration}
              onChange={(e) => setBookDuration(Number(e.target.value))}
            />
          </label>
          <label>
            Motivo
            <textarea value={motive} maxLength={200} onChange={(e) => setMotive(e.target.value)} />
          </label>
          <button disabled={busy}>Agendar cita</button>
        </form>
      </div>
    </section>
  );
}

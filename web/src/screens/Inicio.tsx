import { useEffect, useState } from 'react';
import type { PacientePage } from '@genki/shared';
import type { CITA } from '@genki/shared/full/agenda';
import { ApiError, api, errorMessage } from '../api';
import { navigate } from '../router';

function guatemalaToday(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Guatemala',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

async function countPendingCharges(): Promise<number> {
  const ids: number[] = [];
  let page = 1;
  let total = 0;
  do {
    const body = await api<PacientePage>(
      `/api/pacientes?q=&estado=todos&page=${page}&page_size=50`,
    );
    total = body.total;
    for (const row of body.items) ids.push(Number(row.paciente.id_paciente));
    if (body.items.length === 0) break;
    page += 1;
  } while (ids.length < total && page <= 20);

  let pending = 0;
  let denied = 0;
  for (const id of ids) {
    try {
      const charges = await api<{ total: number }>(
        `/api/pacientes/${id}/cargos?page=1&page_size=1`,
      );
      pending += charges.total;
    } catch (error) {
      if (error instanceof ApiError && error.code === 'not_found') continue;
      if (error instanceof ApiError && error.code === 'forbidden') {
        denied += 1;
        continue;
      }
      throw error;
    }
  }
  if (ids.length > 0 && denied === ids.length) throw new ApiError('forbidden', 403);
  return pending;
}

function Card({
  title,
  value,
  note,
  action,
  onOpen,
}: {
  title: string;
  value: number | null;
  note: string;
  action: string;
  onOpen: () => void;
}) {
  return (
    <article className="dash-card">
      <h2>{title}</h2>
      <strong>{note ? '—' : value === null ? '…' : value}</strong>
      {note ? (
        <p className="error">{note}</p>
      ) : (
        <button type="button" onClick={onOpen}>
          {action}
        </button>
      )}
    </article>
  );
}

export function Inicio() {
  const [pacientes, setPacientes] = useState<number | null>(null);
  const [citas, setCitas] = useState<number | null>(null);
  const [cargos, setCargos] = useState<number | null>(null);
  const [notes, setNotes] = useState({ pacientes: '', citas: '', cargos: '' });

  useEffect(() => {
    let active = true;
    const fail =
      (key: 'pacientes' | 'citas' | 'cargos') =>
      (error: unknown): void => {
        if (active) setNotes((current) => ({ ...current, [key]: errorMessage(error) }));
      };
    void api<PacientePage>('/api/pacientes?q=&estado=todos&page=1&page_size=1')
      .then((page) => {
        if (active) setPacientes(page.total);
      })
      .catch(fail('pacientes'));
    void api<CITA[]>(`/api/agenda?fecha=${guatemalaToday()}`)
      .then((rows) => {
        if (active) setCitas(rows.length);
      })
      .catch(fail('citas'));
    void countPendingCharges()
      .then((total) => {
        if (active) setCargos(total);
      })
      .catch(fail('cargos'));
    return () => {
      active = false;
    };
  }, []);

  return (
    <section aria-label="Inicio">
      <h2>Inicio</h2>
      <p className="muted">Resumen de la institución en esta sesión.</p>
      <div className="dash-grid">
        <Card
          title="Pacientes"
          value={pacientes}
          note={notes.pacientes}
          action="Ver pacientes"
          onOpen={() => navigate('/pacientes')}
        />
        <Card
          title="Citas de hoy"
          value={citas}
          note={notes.citas}
          action="Abrir agenda"
          onOpen={() => navigate('/agenda')}
        />
        <Card
          title="Cargos pendientes"
          value={cargos}
          note={notes.cargos}
          action="Ver cargos"
          onOpen={() => navigate('/economia')}
        />
      </div>
    </section>
  );
}

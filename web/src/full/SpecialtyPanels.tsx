import { useState } from 'react';
import type { AuthPrincipalDto } from '@genki/shared';
import { api, errorMessage } from '../api';
import { EntitySelect } from '../components/EntitySelect';

function idem() {
  return `lane2-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function SpecialtyPanels({
  patientId,
  principal,
}: {
  patientId: number;
  principal: AuthPrincipalDto;
}) {
  const kind = principal.institution_kind;
  const [msg, setMsg] = useState('');
  const [profesional, setProfesional] = useState<number | ''>('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function run(label: string, fn: () => Promise<unknown>) {
    setBusy(true);
    setError('');
    setMsg('');
    try {
      const result = await fn();
      setMsg(`${label}: ${JSON.stringify(result).slice(0, 240)}`);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  if (kind === 'hospital_general') {
    return (
      <section>
        <h3>Hospitalización</h3>
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        {msg && <p role="status">{msg}</p>}
        <div className="actions">
          <button disabled={busy} onClick={() => void run('Camas libres', () => api('/api/camas'))}>
            Consultar camas
          </button>
          <button
            disabled={busy}
            onClick={() =>
              void run('Ingreso', () =>
                api(`/api/pacientes/${patientId}/admisiones`, {
                  method: 'POST',
                  headers: { 'Idempotency-Key': idem() },
                  body: JSON.stringify({
                    id_cama: 1,
                    id_diagnostico_ingreso: 1,
                    tipo_ingreso: 'emergencia',
                    fecha_hora_ingreso: new Date().toISOString(),
                  }),
                }),
              )
            }
          >
            Registrar ingreso
          </button>
          <button
            disabled={busy}
            onClick={() =>
              void run('Nota', () =>
                api('/api/admisiones/1/notas', {
                  method: 'POST',
                  headers: { 'Idempotency-Key': idem() },
                  body: JSON.stringify({ contenido: 'Evolución favorable', turno: 'diurno' }),
                }),
              )
            }
          >
            Escribir nota
          </button>
          <button
            disabled={busy}
            onClick={() =>
              void run('Egreso', () =>
                api('/api/admisiones/1/egreso', {
                  method: 'POST',
                  headers: { 'Idempotency-Key': idem() },
                  body: JSON.stringify({
                    id_diagnostico_egreso: 1,
                    condicion_egreso: 'mejorado',
                    fecha_hora_egreso: new Date(Date.now() + 3600_000).toISOString(),
                  }),
                }),
              )
            }
          >
            Registrar egreso
          </button>
        </div>
      </section>
    );
  }

  if (kind === 'centro_pediatrico') {
    return (
      <section>
        <h3>Pediatría</h3>
        <p className="notice">
          Curva de crecimiento sin percentiles OMS (tablas WHO no cargadas en este MVP).
        </p>
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        {msg && <p role="status">{msg}</p>}
        <div className="actions">
          <button
            disabled={busy}
            onClick={() =>
              void run('Perinatal', () =>
                api(`/api/pacientes/${patientId}/perinatal`, {
                  method: 'PUT',
                  headers: { 'Idempotency-Key': idem() },
                  body: JSON.stringify({
                    semanas_gestacion: 39,
                    tipo_parto: 'vaginal',
                    peso_nacimiento_g: 3200,
                  }),
                }),
              )
            }
          >
            Guardar perinatal
          </button>
          <button
            disabled={busy}
            onClick={() => void run('Curva', () => api(`/api/pacientes/${patientId}/crecimiento`))}
          >
            Ver curva
          </button>
          <button
            disabled={busy}
            onClick={() => void run('Vacunas', () => api(`/api/pacientes/${patientId}/vacunas`))}
          >
            Esquema vacunas
          </button>
          <button
            disabled={busy}
            onClick={() =>
              void run('Hito', () =>
                api(`/api/pacientes/${patientId}/hitos/1`, {
                  method: 'PUT',
                  headers: { 'Idempotency-Key': idem() },
                  body: JSON.stringify({
                    alcanzado: true,
                    fecha_evaluacion: new Date().toISOString().slice(0, 10),
                  }),
                }),
              )
            }
          >
            Evaluar hito
          </button>
        </div>
      </section>
    );
  }

  if (kind === 'laboratorio_clinico') {
    return (
      <section>
        <h3>Laboratorio</h3>
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        {msg && <p role="status">{msg}</p>}
        <div className="actions">
          <button
            disabled={busy}
            onClick={() =>
              void run('Orden', () =>
                api('/api/laboratorio/ordenes', {
                  method: 'POST',
                  headers: { 'Idempotency-Key': idem() },
                  body: JSON.stringify({
                    id_paciente: patientId,
                    institucion_origen: 1,
                    medico_solicitante: 'Dr. Demo',
                    prioridad: 'rutina',
                    examenes: ['HEM001'],
                  }),
                }),
              )
            }
          >
            Recibir orden
          </button>
          <button
            disabled={busy}
            onClick={() => void run('Historial', () => api(`/api/pacientes/${patientId}/examenes`))}
          >
            Historial exámenes
          </button>
        </div>
      </section>
    );
  }

  if (kind === 'clinica_odontologica') {
    return (
      <section>
        <h3>Odontología</h3>
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        {msg && <p role="status">{msg}</p>}
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
            disabled={busy || profesional === ''}
            onClick={() =>
              void run('Odontograma', () =>
                api(`/api/pacientes/${patientId}/odontogramas`, {
                  method: 'POST',
                  headers: { 'Idempotency-Key': idem() },
                  body: JSON.stringify({ id_profesional: profesional }),
                }),
              )
            }
          >
            Abrir odontograma
          </button>
          <button
            disabled={busy || profesional === ''}
            onClick={() =>
              void run('Plan', () =>
                api(`/api/pacientes/${patientId}/planes`, {
                  method: 'POST',
                  headers: { 'Idempotency-Key': idem() },
                  body: JSON.stringify({
                    id_profesional: profesional,
                    detalle: [
                      {
                        linea: 1,
                        numero_pieza: 11,
                        codigo_procedimiento: 'RESINA',
                        orden: 1,
                        precio_unitario: '150.00',
                      },
                    ],
                  }),
                }),
              )
            }
          >
            Elaborar plan
          </button>
        </div>
      </section>
    );
  }

  return null;
}

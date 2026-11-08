import { useEffect, useState, type FormEvent } from 'react';
import type { CatalogosDto, RegisterPacienteRequest, ResponsableInput } from '@genki/shared';
import { api, errorMessage, registerPaciente } from '../api';
import { loadSession } from '../session';
import { navigate } from '../router';
const fields = [
  ['tipo_documento', 'Tipo de documento', 20, true],
  ['numero_documento', 'Número de documento', 25, true],
  ['primer_nombre', 'Primer nombre', 60, true],
  ['segundo_nombre', 'Segundo nombre', 60, false],
  ['primer_apellido', 'Primer apellido', 60, true],
  ['segundo_apellido', 'Segundo apellido', 60, false],
  ['tipo_sangre', 'Tipo de sangre', 5, false],
  ['telefono', 'Teléfono', 25, false],
  ['correo', 'Correo', 120, false],
  ['direccion', 'Dirección', 250, false],
] as const;
export function RegisterPaciente() {
  const pediatric = loadSession().institution_kind === 'centro_pediatrico';
  const [catalogs, setCatalogs] = useState<CatalogosDto | null>(null);
  const [catalogError, setCatalogError] = useState('');
  const [retry, setRetry] = useState(0);
  const [guardians, setGuardians] = useState<number[]>(pediatric ? [0] : []);
  const [nextId, setNextId] = useState(1);
  const [principal, setPrincipal] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
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
  }, [retry]);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError('');
    const data = new FormData(event.currentTarget);
    const text = (name: string) => String(data.get(name) ?? '').trim();
    const optional = (name: string) => text(name) || null;
    const input: RegisterPacienteRequest = {
      tipo_documento: text('tipo_documento'),
      numero_documento: text('numero_documento'),
      primer_nombre: text('primer_nombre'),
      segundo_nombre: optional('segundo_nombre'),
      primer_apellido: text('primer_apellido'),
      segundo_apellido: optional('segundo_apellido'),
      fecha_nacimiento: text('fecha_nacimiento'),
      sexo: text('sexo') as RegisterPacienteRequest['sexo'],
      tipo_sangre: optional('tipo_sangre'),
      telefono: optional('telefono'),
      correo: optional('correo'),
      direccion: optional('direccion'),
      id_municipio: text('id_municipio') ? Number(text('id_municipio')) : null,
      ...(pediatric
        ? {
            responsables: guardians.map((id) => ({
              tipo_documento: text(`g${id}-tipo_documento`),
              numero_documento: text(`g${id}-numero_documento`),
              nombre_completo: text(`g${id}-nombre_completo`),
              telefono: text(`g${id}-telefono`),
              parentesco: text(`g${id}-parentesco`) as ResponsableInput['parentesco'],
              correo: optional(`g${id}-correo`),
              direccion: optional(`g${id}-direccion`),
              es_principal: id === principal,
            })),
          }
        : {}),
    };
    try {
      const saved = await registerPaciente(input);
      navigate(`/pacientes/${saved.paciente.id_paciente}`);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <section>
      <h2>Registrar paciente y abrir expediente</h2>
      <p>El registro se guarda en una sola operación. Los campos con * son obligatorios.</p>
      {catalogError ? (
        <div role="alert">
          <p className="error">{catalogError}</p>
          <button onClick={() => setRetry((n) => n + 1)}>Reintentar catálogos</button>
        </div>
      ) : (
        !catalogs && <p role="status">Cargando catálogos…</p>
      )}
      <form onSubmit={submit}>
        <fieldset disabled={busy}>
          <legend>Identidad y contacto</legend>
          <div className="form-grid">
            {fields.map(([name, label, max, required]) => (
              <label key={name}>
                {label}
                {required ? ' *' : ''}
                <input
                  name={name}
                  required={required}
                  maxLength={max}
                  type={name === 'correo' ? 'email' : 'text'}
                />
              </label>
            ))}
            <label>
              Fecha de nacimiento *
              <input
                name="fecha_nacimiento"
                type="date"
                max={new Date().toISOString().slice(0, 10)}
                required
              />
            </label>
            <label>
              Sexo *
              <select name="sexo" required>
                <option value="">Seleccione</option>
                <option value="M">M</option>
                <option value="F">F</option>
                <option value="X">X</option>
              </select>
            </label>
            <label>
              Municipio
              <select name="id_municipio" disabled={!catalogs}>
                <option value="">Sin especificar</option>
                {catalogs?.municipios.map((m) => (
                  <option key={m.id_municipio} value={m.id_municipio}>
                    {m.nombre}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </fieldset>
        {pediatric && (
          <fieldset disabled={busy}>
            <legend>Responsables (de 1 a 5; exactamente un principal)</legend>
            {guardians.map((id, index) => (
              <fieldset key={id}>
                <legend>Responsable {index + 1}</legend>
                <div className="form-grid">
                  {(
                    [
                      ['tipo_documento', 'Tipo de documento', 20],
                      ['numero_documento', 'Número de documento', 25],
                      ['nombre_completo', 'Nombre completo', 150],
                      ['telefono', 'Teléfono', 25],
                      ['correo', 'Correo', 120],
                      ['direccion', 'Dirección', 250],
                    ] as const
                  ).map(([name, label, max]) => (
                    <label key={name}>
                      {label}
                      {name !== 'correo' && name !== 'direccion' ? ' *' : ''}
                      <input
                        name={`g${id}-${name}`}
                        required={name !== 'correo' && name !== 'direccion'}
                        maxLength={max}
                        type={name === 'correo' ? 'email' : 'text'}
                      />
                    </label>
                  ))}
                  <label>
                    Parentesco *
                    <select name={`g${id}-parentesco`}>
                      {['madre', 'padre', 'abuelo', 'tutor_legal', 'otro'].map((p) => (
                        <option key={p} value={p}>
                          {p === 'tutor_legal' ? 'Tutor legal' : p}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="radio">
                    <input
                      type="radio"
                      name="principal"
                      checked={principal === id}
                      onChange={() => setPrincipal(id)}
                    />
                    Principal
                  </label>
                </div>
                <button
                  type="button"
                  disabled={guardians.length === 1}
                  onClick={() => {
                    const remaining = guardians.filter((g) => g !== id);
                    setGuardians(remaining);
                    if (principal === id) setPrincipal(remaining[0]!);
                  }}
                >
                  Quitar responsable {index + 1}
                </button>
              </fieldset>
            ))}
            <button
              type="button"
              disabled={guardians.length >= 5}
              onClick={() => {
                setGuardians([...guardians, nextId]);
                setNextId(nextId + 1);
              }}
            >
              Agregar responsable
            </button>
          </fieldset>
        )}
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        <div className="actions">
          <button data-testid="register-submit" disabled={busy || !catalogs || !!catalogError}>
            {busy ? 'Guardando…' : 'Registrar paciente'}
          </button>
          <button type="button" disabled={busy} onClick={() => navigate('/pacientes')}>
            Cancelar
          </button>
        </div>
      </form>
    </section>
  );
}

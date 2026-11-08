import { useEffect, useState, type FormEvent } from 'react';
import type { PacientePage } from '@genki/shared';
import { api, errorMessage } from '../api';
import { navigate } from '../router';
export function Pacientes({ search }: { search: string }) {
  const params = new URLSearchParams(search);
  const q = params.get('q') ?? '';
  const estado = ['activo', 'archivado', 'todos'].includes(params.get('estado') ?? '')
    ? params.get('estado')!
    : 'activo';
  const page = Math.min(10000, Math.max(1, Number(params.get('page')) || 1));
  const [result, setResult] = useState<PacientePage | null>(null);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let active = true;
    setResult(null);
    setError('');
    void api<PacientePage>(
      `/api/pacientes?${new URLSearchParams({ q, estado, page: String(page), page_size: '20' })}`,
    )
      .then((value) => {
        if (active) setResult(value);
      })
      .catch((e) => {
        if (active) setError(errorMessage(e));
      });
    return () => {
      active = false;
    };
  }, [q, estado, page, retry]);
  function go(next: number, term = q, state = estado) {
    navigate(`/pacientes?${new URLSearchParams({ q: term, estado: state, page: String(next) })}`);
  }
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    go(1, String(form.get('q')).trim(), String(form.get('estado')));
  }
  return (
    <section>
      <div className="actions">
        <h2>Pacientes</h2>
        <button data-testid="patient-register" onClick={() => navigate('/pacientes/nuevo')}>
          Registrar paciente
        </button>
      </div>
      <form className="search-form" onSubmit={submit} key={`${q}:${estado}`}>
        <label>
          Documento, expediente o nombre
          <input name="q" data-testid="patient-search" defaultValue={q} maxLength={100} />
        </label>
        <label>
          Estado
          <select name="estado" defaultValue={estado}>
            <option value="activo">Activos</option>
            <option value="archivado">Archivados</option>
            <option value="todos">Todos</option>
          </select>
        </label>
        <button>Buscar</button>
      </form>
      {error ? (
        <div role="alert">
          <p className="error">{error}</p>
          <button onClick={() => setRetry((n) => n + 1)}>Reintentar</button>
        </div>
      ) : !result ? (
        <p role="status">Cargando pacientes…</p>
      ) : (
        <>
          <p role="status">{result.total} pacientes encontrados</p>
          {!result.items.length ? (
            <p>No se encontraron pacientes.</p>
          ) : (
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Paciente</th>
                    <th>Documento</th>
                    <th>Expediente</th>
                    <th>Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {result.items.map(({ paciente: p, expediente: e }) => (
                    <tr key={p.id_paciente}>
                      <td>
                        <a
                          href={`/pacientes/${p.id_paciente}`}
                          onClick={(event) => {
                            event.preventDefault();
                            navigate(`/pacientes/${p.id_paciente}`);
                          }}
                        >
                          {[
                            p.primer_nombre,
                            p.segundo_nombre,
                            p.primer_apellido,
                            p.segundo_apellido,
                          ]
                            .filter(Boolean)
                            .join(' ')}
                        </a>
                      </td>
                      <td>{p.numero_documento}</td>
                      <td>{e.numero_expediente}</td>
                      <td>{e.estado}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <nav aria-label="Paginación" className="actions">
            <button disabled={page <= 1} onClick={() => go(page - 1)}>
              Anterior
            </button>
            <span>Página {page}</span>
            <button
              disabled={page * result.page_size >= result.total || page >= 10000}
              onClick={() => go(page + 1)}
            >
              Siguiente
            </button>
          </nav>
        </>
      )}
    </section>
  );
}

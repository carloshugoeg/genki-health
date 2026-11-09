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
  const pages = result ? Math.max(1, Math.ceil(result.total / result.page_size)) : 1;
  return (
    <section className="pacientes">
      <header className="page-header">
        <div>
          <h2>Pacientes</h2>
          <p className="muted">Busque por documento, número de expediente o nombre.</p>
        </div>
        <div className="page-actions">
          <button
            type="button"
            className="btn-primary"
            data-testid="patient-register"
            onClick={() => navigate('/pacientes/nuevo')}
          >
            Registrar paciente
          </button>
        </div>
      </header>
      <form className="search-form" role="search" onSubmit={submit} key={`${q}:${estado}`}>
        <label>
          Documento, expediente o nombre
          <input
            name="q"
            type="search"
            data-testid="patient-search"
            defaultValue={q}
            maxLength={100}
            placeholder="Ej. EXP-101 o un apellido"
          />
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
        <div role="alert" className="state-panel state-panel--error">
          <p className="error">{error}</p>
          <button type="button" className="btn-secondary" onClick={() => setRetry((n) => n + 1)}>
            Reintentar
          </button>
        </div>
      ) : !result ? (
        <p role="status" className="state-panel state-panel--loading">
          Cargando pacientes…
        </p>
      ) : (
        <>
          <p role="status" className="result-count">
            {result.total} pacientes encontrados
          </p>
          {!result.items.length ? (
            <div className="state-panel state-panel--empty">
              <p>
                <strong>No se encontraron pacientes.</strong>
              </p>
              <p className="muted">
                Revise el término de búsqueda o cambie el filtro de estado. Si el paciente es nuevo,
                regístrelo.
              </p>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => navigate('/pacientes/nuevo')}
              >
                Registrar paciente
              </button>
            </div>
          ) : (
            <div className="table-scroll">
              <table className="data-table data-table--stack">
                <thead>
                  <tr>
                    <th scope="col">Paciente</th>
                    <th scope="col">Documento</th>
                    <th scope="col">Expediente</th>
                    <th scope="col">Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {result.items.map(({ paciente: p, expediente: e }) => (
                    <tr key={p.id_paciente}>
                      <td data-label="Paciente">
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
                      <td data-label="Documento" className="cell-code">
                        {p.numero_documento}
                      </td>
                      <td data-label="Expediente" className="cell-code">
                        {e.numero_expediente}
                      </td>
                      <td data-label="Estado">
                        <span className={`badge badge--${e.estado}`}>{e.estado}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <nav aria-label="Paginación" className="pager">
            <button
              type="button"
              className="btn-secondary"
              disabled={page <= 1}
              onClick={() => go(page - 1)}
            >
              Anterior
            </button>
            <span>
              Página {page} de {pages}
            </span>
            <button
              type="button"
              className="btn-secondary"
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

import { INSTITUTION_ENGINE_ASSIGNMENTS } from '@genki/shared';

export function App() {
  return (
    <main className="shell">
      <header className="brand">
        <p className="eyebrow">Bases de Datos II</p>
        <h1>Genki Health</h1>
        <p className="lede">
          Plataforma de historiales clínicos. Entrega II scaffold (E2-01). El login queda bloqueado
          hasta que Carlos decida Auth.
        </p>
      </header>

      <section className="engines" aria-labelledby="engines-title">
        <h2 id="engines-title">Instituciones y motores</h2>
        <ul>
          {INSTITUTION_ENGINE_ASSIGNMENTS.map((row) => (
            <li key={row.kind}>
              <strong>{row.nombre}</strong> → {row.engine}
            </li>
          ))}
        </ul>
      </section>

      <section className="auth-block" aria-labelledby="auth-title">
        <h2 id="auth-title">Autenticación</h2>
        <p>
          needs-human: flujo de login, claims JWT, política de contraseñas y sesión. No inventar.
        </p>
        <button type="button" disabled>
          Iniciar sesión (pendiente)
        </button>
      </section>
    </main>
  );
}

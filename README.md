# Genki Health

Plataforma compartida de historiales clínicos para cuatro instituciones médicas independientes.

- **Curso:** Bases de Datos II — Universidad Rafael Landívar
- **Equipo:** Carlos Hugo Escobar Gómez · Héctor Jordin Adolfo García Coyoy

## Descripción

Cada institución registra pacientes, abre su expediente y mantiene su historial clínico (consultas, diagnósticos, tratamientos y recetas), con archivo y reactivación del expediente. Las cuatro instituciones usan la misma API y la misma interfaz web, pero cada una guarda sus datos en un motor de base de datos distinto. Al iniciar sesión, cada usuario queda enrutado al motor de su institución.

| Id | Institución | Motor |
| --- | --- | --- |
| 1 | Hospital general | PostgreSQL |
| 2 | Centro médico pediátrico | MySQL |
| 3 | Laboratorio clínico | MongoDB |
| 4 | Clínica odontológica | Firebase (Firestore) |

La justificación de cada asignación está en `ENTREGA-II/documento-comparativo.pdf` (sección 1).

## Estructura del repositorio

| Ruta | Contenido |
| --- | --- |
| `ENTREGA-I/` | Entrega I: análisis, modelo entidad-relación y modelo relacional (PDF, transcripción y diagramas). |
| `ENTREGA-II/` | Entrega II: documento comparativo, arquitectura, decisiones (ADR) y la tabla «Rúbrica → evidencia» (`ENTREGA-II/README.md`). |
| `server/` | API Fastify con arquitectura hexagonal: `domain/`, `application/`, `ports/`, `adapters/` (uno por motor) y `config/`. |
| `web/` | Cliente React + Vite (misma interfaz para las cuatro instituciones). |
| `shared/` | Tipos compartidos y asignación institución → motor. |
| `infra/` | Contenedores Docker de los motores y configuración del emulador de Firestore. |
| `scripts/` | Migraciones, semillas de demostración y compuerta de validación. |
| `tests/` | Auditoría de punta a punta contra la aplicación levantada (`tests/e2e-audit/`). |

## Cómo levantarlo

Requisitos: **Docker** (con Compose v2, p. ej. Docker Desktop encendido) y **Node.js ≥ 20**. No se necesitan credenciales de Google: la clínica odontológica corre sobre el emulador oficial de Firestore dentro de Docker.

```bash
git clone https://github.com/carloshugoeg/genki-health.git
cd genki-health
bash levantar.sh
```

`levantar.sh` hace todo de una vez y se puede volver a ejecutar sin problema:

1. Verifica Docker y Node.
2. Genera `.env` con contraseñas locales aleatorias.
3. Levanta PostgreSQL, MySQL, MongoDB (replica set `rs0`) y el emulador de Firestore.
4. Instala dependencias.
5. Crea esquemas, permisos y datos de demostración en los cuatro motores.
6. Inicia la API y la web, y comprueba un inicio de sesión.

La primera vez tarda varios minutos porque descarga las imágenes.

- Aplicación web: <http://127.0.0.1:5173>
- API: <http://127.0.0.1:3000/health>
- Detener: `bash detener.sh` (conserva los datos) o `bash detener.sh --borrar-datos`.
- Logs: `.runtime/logs/`. Si un puerto está ocupado, cámbialo en `.env` y vuelve a ejecutar `bash levantar.sh`.

Con Claude Code basta con pedirle: *«levanta https://github.com/carloshugoeg/genki-health»*. El `CLAUDE.md` del repositorio le indica que ejecute `bash levantar.sh`.

## Usuarios de demostración

Contraseña de todos: `admin123!`. Los datos son sintéticos.

| Usuario | Institución | Motor |
| --- | --- | --- |
| `demo-1-administrador@example.invalid`, `demo-1-medico@example.invalid` | Hospital general | PostgreSQL |
| `demo-2-administrador@example.invalid`, `demo-2-medico@example.invalid` | Centro médico pediátrico | MySQL |
| `demo-3-administrador@example.invalid`, `demo-3-medico@example.invalid` | Laboratorio clínico | MongoDB |
| `demo-4-administrador@example.invalid`, `demo-4-medico@example.invalid`, `demo-4-odontologo@example.invalid` | Clínica odontológica | Firebase (Firestore) |
| `superadmin@example.invalid` | Elige la institución desde `/panel` | El de la institución elegida |

## Pruebas

```bash
npm test               # pruebas unitarias y de contrato (shared, server, web)
npm run typecheck      # TypeScript sin emitir
npm run lint           # ESLint
npm run depcruise      # reglas de dependencia de la arquitectura hexagonal
npm run test:repo      # sin secretos versionados y configuración segura de los contenedores
bash scripts/validate.sh   # todo lo anterior más build, igual que el CI
```

Con la aplicación levantada, la auditoría de punta a punta recorre el flujo completo en las cuatro instituciones, el aislamiento entre ellas, la persistencia tras reiniciar y la interfaz web: ver `tests/e2e-audit/README.md`.

Las suites contra los motores reales (`server/test/contracts/` y las pruebas de cada adaptador) se activan con `TEST_ENGINES=1` y necesitan los motores corriendo y sus URL de administración en `.env` (`PG_ADMIN_URL`, `MYSQL_ADMIN_URL`, `MONGO_ADMIN_URI`, `FIRESTORE_EMULATOR_HOST`); usan bases desechables `genki_test_*`.

## Arquitectura en breve

1. El cliente web (React) habla solo con la API REST; nunca con una base de datos.
2. Al iniciar sesión, el JWT lleva la institución y su motor (`institucion_kind`, `motor`).
3. En cada solicitud, el registro de adaptadores (`server/src/config/adapter-registry.ts`) entrega el conjunto de adaptadores de esa institución.
4. Los casos de uso (`server/src/application/`) dependen solo de puertos, así que la lógica es la misma para los cuatro motores.
5. Cada adaptador (`server/src/adapters/{postgres,mysql,mongodb,firebase}/`) usa el driver nativo del motor, con SQL y modelo documental escritos a mano, sin ORM.

Detalle en `ENTREGA-II/arquitectura.md`.

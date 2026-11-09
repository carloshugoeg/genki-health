# Entrega II — Aplicación cliente-servidor en cuatro motores

Bases de Datos II, Universidad Rafael Landívar.

**Equipo:** Carlos Hugo Escobar Gómez · Héctor Jordin Adolfo García Coyoy

## Contenido de esta carpeta

| Archivo | Contenido |
| --- | --- |
| `documento-comparativo.pdf` / `.md` | Documento comparativo: asignación y justificación, modelado, consistencia, seguridad, consultas equivalentes y resultados de la auditoría. |
| `arquitectura.md` | Arquitectura hexagonal, enrutamiento de cada solicitud a su motor y mantenimiento del historial. |
| `decisiones/` | Decisiones de arquitectura (ADR-0001…0005). |

## Asignación institución → motor

| Id | Institución | Clave (`institution_kind`) | Motor | Adaptador |
| --- | --- | --- | --- | --- |
| 1 | Hospital general | `hospital_general` | PostgreSQL | `server/src/adapters/postgres/` |
| 2 | Centro médico pediátrico | `centro_pediatrico` | MySQL | `server/src/adapters/mysql/` |
| 3 | Laboratorio clínico | `laboratorio_clinico` | MongoDB | `server/src/adapters/mongodb/` |
| 4 | Clínica odontológica | `clinica_odontologica` | Firebase (Firestore) | `server/src/adapters/firebase/` |

La justificación de cada asignación está en la sección 1 del documento comparativo.

## Rúbrica → evidencia

| Requisito | Dónde se demuestra |
| --- | --- |
| Aplicación cliente-servidor funcional | API Fastify en `server/` (`server/src/main.ts`) y cliente React + Vite en `web/`. Se levanta con `bash levantar.sh` (ver `README.md` de la raíz). |
| Cuatro motores, uno por institución, con justificación escrita | Documento comparativo §1; `decisiones/ADR-0002-institution-engines.md`; `shared/src/engines.ts`; adaptadores `server/src/adapters/{postgres,mysql,mongodb,firebase}/`. |
| Modelado corregido | Correcciones anotadas en `../ENTREGA-I/analisis-y-modelo-relacional.md` y `../ENTREGA-I/diagramas/`; esquema físico en `server/src/adapters/postgres/migrations/` y `server/src/adapters/mysql/migrations/`; documento comparativo §2. |
| Consultas equivalentes en los cuatro motores | Documento comparativo §6 (búsqueda de paciente, cierre de consulta, historial y tabla de diferencias); código en `server/src/adapters/*/paciente-repository.ts` y `server/src/adapters/*/consulta-repository.ts`. |
| Modelo documental embed vs reference (MongoDB y Firebase) | Documento comparativo §2; `decisiones/ADR-0003-mongodb-aggregates.md` y `ADR-0004-firestore-aggregates.md`; validadores en `server/src/adapters/mongodb/schema.ts`; índices en `infra/firebase/firestore.indexes.json`. |
| UI que no cambia según el motor | Una sola SPA (`web/src/App.tsx`, `web/src/screens/`, `web/src/components/AppShell.tsx`) contra las mismas rutas REST para las cuatro instituciones; `arquitectura.md` §2. |
| Registro de paciente nuevo | Pantalla `/pacientes/nuevo` (`web/src/screens/RegisterPaciente.tsx`); `POST /api/pacientes`; caso de uso `server/src/application/register-paciente.ts`. |
| Mantenimiento de historiales (consultas, diagnósticos, tratamientos, recetas) | Pantallas `web/src/screens/Consulta.tsx`, `web/src/screens/Historial.tsx` y `web/src/components/MantenimientoConsulta.tsx`; caso de uso `server/src/application/close-consulta.ts`; corrección y anulación en `server/src/adapters/http/clinical-maintenance-routes.ts`; documento comparativo §3. |
| Archivo / desactivación de historiales | `web/src/components/ArchiveDialog.tsx` y `ReactivateDialog.tsx`; `POST /api/pacientes/:id/archivo` (`server/src/application/archive-expediente.ts`) y `POST /api/pacientes/:id/reactivacion`. |
| Enrutamiento por usuario a su motor | Claims del JWT en `shared/src/auth.ts`; `server/src/adapters/auth/service.ts`; `server/src/config/adapter-registry.ts`; resolución por solicitud en `server/src/adapters/http/app.ts`; selector del superadministrador en `web/src/screens/Panel.tsx`; `arquitectura.md` §2. |
| Documento comparativo (modelado, consistencia, seguridad, justificación) | `documento-comparativo.pdf`: §1 justificación, §2 modelado, §3 consistencia, §4 seguridad. |
| Verificación automatizada | Suite de contrato de adaptadores `server/test/contracts/`; auditoría de punta a punta `tests/e2e-audit/` (flujo completo, aislamiento entre instituciones, persistencia tras reinicio y prueba de la UI), resultados en `tests/e2e-audit/results/`. |

## Usuarios de demostración

Todas las cuentas usan la contraseña `admin123!`.

| Usuario | Institución | Motor |
| --- | --- | --- |
| `demo-1-administrador@example.invalid`, `demo-1-medico@example.invalid` | 1 · Hospital general | PostgreSQL |
| `demo-2-administrador@example.invalid`, `demo-2-medico@example.invalid` | 2 · Centro médico pediátrico | MySQL |
| `demo-3-administrador@example.invalid`, `demo-3-medico@example.invalid` | 3 · Laboratorio clínico | MongoDB |
| `demo-4-administrador@example.invalid`, `demo-4-medico@example.invalid`, `demo-4-odontologo@example.invalid` | 4 · Clínica odontológica | Firebase (Firestore) |
| `superadmin@example.invalid` | Cualquiera: elige la institución desde `/panel` | El de la institución elegida |

También existen `demo-N-recepcion@example.invalid` y `demo-N-auditor@example.invalid` para N = 1…4. Los datos son sintéticos.

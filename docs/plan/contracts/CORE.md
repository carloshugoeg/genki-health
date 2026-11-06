# Frozen contract C1 — scope, vocabulary and invariants

Planning baseline: main 2fa2c157; PR 9 tree 6b6a58167d65bbc1f2ca06c88de706efd074da8f. This is a proposed execution specification, not permission to merge, change permissions, publish or deploy. P0 adopts the specification only after the owners authorize execution. No implementation work was performed while producing it.

## C1.1 Live operation matrix

The same UI, application functions and port signatures run for Hospital/PostgreSQL (institution 1), Pediátrico/MySQL (2), Laboratorio/MongoDB (3), Odontología/Firestore (4). Identity for all four is Hospital PostgreSQL; clinical records never cross stores.

| OP | Live scope on each of the four engines |
|---|---|
|01|Login email/password/institution, refresh rotation, current principal.|
|02|Logout records refresh revocation and client clears session; an already issued bearer expires within 30 minutes. This bounded JWT limitation is explicitly demonstrated, not called immediate access revocation.|
|07|Exact document or expediente-number search, or case-insensitive literal name substring; default only active expedientes; archived filter explicit.|
|08 + 13|One atomic patient + expediente registration, with document uniqueness; pediatric guardian written in that same transaction before the expediente.|
|11|Guardians captured inline at pediatric registration, no separate guardian maintenance screen.|
|12|Identity + expediente display only; allergy/antecedent parts of the source operation are deferred and labeled absent.|
|14|Chronological consultation history, including diagnoses, treatments, prescription and medication details; only the implemented consultation history, not hospitalization/exam history.|
|26,28,29,30,31|One consultation composer, not five staged APIs: submit creates a closed consultation, ≥1 diagnosis, ≥1 treatment, and optional prescription (if included, ≥1 detail), atomically. No partially saved consultation. OP26 is draft-in-browser only until save.|
|18|Archive with reason, optional observation; disappears from active search, history preserved.|

OP26–31 apply to H/P/O in the original source. On L the same consultation is explicitly an academic shared-core demonstration; it is not an exam workflow. This extension is an ASSUMPTION, not an assertion that Entrega I lists it for L.

Deferred operations, exhaustively: OP03–06,09–10,15–17,19–25,27,32–77. OP11,12,14,26 have only the bounded portions above. These are not fake-success API endpoints. The UI shows a single “Fuera del alcance de esta entrega” panel listing agenda, signos vitales, alergias/antecedentes/adjuntos, hospitalización/notas de evolución, crecimiento/vacunas/hitos, laboratorio especializado, odontograma/planes, inventario/honorarios/facturación/caja, gestión de usuarios/contraseñas and reactivación. No clickable nonfunctional forms. No OP36 note is repurposed as an outpatient note: its ADMISION FK is mandatory in the source model.

## C1.2 Invariants

1. Institution is taken only from verified principal. No input accepts `id_institucion` or `motor`. A scoped repository returns null for any other institution's id; HTTP returns 404, not a disclosure.
2. Integers are positive signed 32-bit surrogate ids, serialized as JSON numbers; preserve branded types from shared/src/ids.ts. No UUID replacement. Document engines allocate integers transactionally. Gaps after rollback are allowed; committed ids are never reused. An uncommitted reservation may be allocated again after abort because it was never exposed as a saved record.
3. One patient per institution per `numero_documento` regardless of document type (source sección 7.4 alternate key). Normalize document with trim + uppercase; names trim, preserve accents. No accent folding. Expedition number `EXP-<id_expediente>` unique within its institution. PACIENTE.estado remains activo/inactivo; never set it to archivado.
4. Pediatric registration requires ≥1 guardian and exactly one principal. This applies to every pediatric registration, conservatively following locked.md, not only to an age calculation. Outside institution 2, `responsables` must be absent or empty. No second guardian-maintenance aggregate is added.
5. A consultation may be appended only while expediente is activo. Archive and close serialize on that expediente: either close commits first, or it fails `expediente_archived`; never a close committed after archive won the race. Archived histories are readable. No DELETE/update clinical endpoint. Archive a second time fails 409.
6. Exactly one primary diagnosis. Every treatment references an in-range diagnosis index. At least one treatment per submitted diagnosis. Prescription is optional; when present every medication exists and is active, details contain distinct medication ids. The consultation, all children, all recipe details either commit together or none commit.
7. SQL timestamps PG TIMESTAMPTZ; MySQL DATETIME(3) in UTC (connection time_zone '+00:00'); wire ISO strings with Z. Birth and treatment dates are YYYY-MM-DD; no derived age or BMI persisted. User-facing timestamps display America/Guatemala (UTC-6).
8. Existing DTO keys in shared/src/clinical.ts and auth.ts are retained. Optional request fields become explicit null in DTO responses. No driver types escape a port. All repository methods reject with ClinicalError (C2) rather than driver text.
9. `numero_colegiado`: nullable UNIQUE, never empty; PROFESIONAL does not acquire id_tipo_personal/modalidad_contrato/fecha_ingreso. Seed professional registration validates the source TIPO_PERSONAL.requires flag before insert; source metadata used by the seeder is not an extra PROFESIONAL column or a new FK. No professional-maintenance route exists.
10. No ORM, query builder, cross-adapter import, real patient, actual payment, production hosting or real Firebase project is needed. SQL credentials, JWT secret and seed passwords are read from environment, never literal defaults in tracked files.

## C1.3 MVP screens (Spanish)

Use a tiny browser History API router, no routing dependency. `/login`, `/pacientes?q=&estado=activo`, `/pacientes/nuevo`, `/pacientes/:id`, `/pacientes/:id/consulta/nueva`. Unknown route redirects to `/pacientes` after login. One header shows institution name and engine for demonstration only. Same forms/components for all engines; only pediatric guardian fieldset depends on institution, never on motor.

- Login: institution select, empty email/password; errors never show submitted passwords. Logout awaits server refresh revocation then clears local session even on network failure and redirects to login.
- Search: document/expediente/name input, active/archived/all select, paginated next/previous, empty/error/loading states, register link.
- Register: identity/contact fields from C2, guardian array if pediatric; success navigates to ficha; 409 stays on form.
- Ficha: patient identity, expediente state, history newest first, expandable diagnosis/treatment/prescription details. Archived badge; composer/archive actions hidden when archived; archive reason confirmation dialog; no reactivation button.
- Consultation: one or more diagnoses, primary radio; treatment per diagnosis; optional recipe selecting medication from catalog; submit once while busy; archive race error returns to ficha without dropping explanatory error.

## C1.4 Source links

- `PROJECT-DESC.md`, Entrega II resultados esperados (consultations/diagnoses/prescribed medications are not omitted).
- `poteto-mode/decisions/locked.md`, Case/clinical/E1-06/Auth/Model B.
- `docs/entregas/entrega-1/analisis-y-modelo-relacional.md`, §§5,7.4,7.5,9,10.
- `docs/specs/adr/ADR-0001-stack-no-orm.md`, `ADR-0002-institution-engines.md`.
- Existing functions: `server/src/application/register-paciente.ts`, `archive-expediente.ts`; existing HTTP exposes registration, not archive. Memory UoW currently only calls the callback and has no rollback; registry currently constructs a fresh set on every resolve. Both defects are explicit tickets, not assumed fixed.

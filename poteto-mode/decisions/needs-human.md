# Needs a human

Agents do not close these. Carlos or Jordin decides. Until then, diagrams and the transcription follow the section each ticket names, and they do not "fix" the other section.

Human-facing decision brief (Spanish, historical): `docs/progress/decision-brief-e1-06.md`.

## Closed by Carlos (2026-10-14) — E1-06

~~1. `PROFESIONAL` in sección 5.1 has `id_tipo_personal`, `modalidad_contrato`, and `fecha_ingreso`. The textual schema in sección 7.4 omits them. Sección 7.6 still describes `PROFESIONAL.id_tipo_personal` as a foreign key.~~
**Locked B:** leave 7.4 without those three columns; correct 7.6 / prose. See `locked.md`.

~~2. `CAMA` in sección 5.2 has `tipo_cama` and `codigo_servicio`. Sección 7.4 has `id_cama`, `id_servicio`, `codigo`, and `estado` only.~~
**Locked A:** add `tipo_cama` and `codigo_servicio` to relational 7.4 / `rel-*.mmd`. See `locked.md`.

~~3. `PACIENTE.id_municipio` references `MUNICIPIO`. That catalog is not one of the 58 entities in sección 4.~~
**Locked A:** add `MUNICIPIO` to the entity inventory and the model. See `locked.md`.

~~4. Sección 5.2 says a correction to an evolution note is a new note that references the previous one. Sección 7.4 has no self-reference column on `NOTA_EVOLUCION`.~~
**Locked A:** optional FK to the previous note in the relational model. See `locked.md`.

~~5. `numero_colegiado` is an alternate unique key in sección 7.4 and optional in sección 5.1. Those two constraints cannot both be a single-column unique key without a partial index. The PDF does not choose the mechanism for PostgreSQL versus MySQL.~~
**Locked:** required when `TIPO_PERSONAL.requiere_colegiado`; else `NULL` (never empty string); UNIQUE among non-null; nullable UNIQUE on PostgreSQL/MySQL; DDL in Entrega II; no compound unique. See `locked.md`.

No open needs-human items remain for Entrega I attribute conflicts.

## Closed by Carlos (2026-10-19) — Auth

~~1. Login flow~~ **Locked:** email + password; institution scoped at login. See `locked.md`.

~~2. JWT claims~~ **Locked:** completo claim set (`sub`, `email`, `institucion_id`, `institucion_kind`, `roles`, `motor`, `iat`, `exp`, `typ`). See `locked.md`.

~~3. Password policy~~ **Locked:** min 8 chars, letter+digit, Argon2id only. See `locked.md`.

~~4. Session handling~~ **Locked:** access JWT (30m) + refresh JWT (14d), refresh rotates on use. See `locked.md`.

No open needs-human Auth items remain. Multitenant permission *grants* beyond institution routing at login stay stop-and-ask if they appear.

## Execution assumptions (E2 package, not historical human answers)

Appended by E2-P0-01 after Carlos authorized the frozen execution package (2026-11-05/06). These are adopted planning defaults, not fabricated closures of open product questions. Auth locks above stay intact.

- **A5 ASSUMPTION (grant scope).** Adopt C5 minimal runtime app/identity/report-role matrix plus per-institution Firestore deny-by-default rules and Mongo collection roles. No full RBAC admin UI. No encryption-at-rest implementation in this package. Broader multitenant permission grants beyond institution routing at login remain stop-and-ask.

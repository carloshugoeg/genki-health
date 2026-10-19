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

## Open for Entrega II (Auth — Carlos)

Agents must not invent these. `AuthPort` / `NeedsHumanAuthAdapter` fail closed until decided.

1. **Login flow** — how credentials are collected and verified against Hospital PostgreSQL (identity system of record).
2. **JWT claims** — exact claim set beyond the architecture sketch of `institutionId` (roles, professional id, token version, etc.).
3. **Password policy** — Argon2id parameters, rotation, lockout beyond `intentos_fallidos` already in the model.
4. **Session handling** — TTL, refresh, logout, and how HTTP middleware binds the token to the adapter registry.

Until Carlos answers, `/api/auth/login` returns HTTP 501 `auth_needs_human`.

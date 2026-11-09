# Locked decisions

These come from the Entrega I PDF and from the architecture note dated 2026-08-27. Agents do not reopen them.

## Case and engines

- Four institutions share one application and keep separate data stores. There is no central patient database.
- Hospital general uses PostgreSQL. The fit stated in the PDF is strict transactional integrity for appointments, diagnoses, and treatments.
- Centro médico pediátrico uses MySQL. The fit stated in the PDF is structured longitudinal data and short, frequent visits.
- Laboratorio clínico uses MongoDB. Exam results change shape by exam type.
- Clínica odontológica uses Firebase (Firestore). The clinic has no technical staff and needs simple secretary flows.
- Each engine is used once. SQLite, Realm, and LiteDB are out.
- Entrega I draws the ER model and the relational model only for Hospital general and Centro médico pediátrico.
- Entities, attributes, data classification, and operations cover all four institutions.
- The written justification of the engine assignment belongs to the Entrega II comparative note, not to a new Entrega I essay.

## Clinical model already chosen in the PDF

- One expediente per patient per institution. History accumulates. It is not one expediente per episode.
- Clinical rows are not deleted. Discharge is `estado = archivado` with a reason.
- Surrogate integer keys. Natural keys stay as alternate unique keys.
- Age and BMI are derived, except `edad_meses` on a pediatric measurement, which is a historical fact.
- A pediatric patient has at least one responsable, exactly one marked principal, before the expediente opens.
- Closing a consultation writes the consultation, diagnoses, treatments, and prescription in one transaction.
- `DETALLE_RECETA` is the only many-to-many resolution named in the relational model.
- `CARGO` is the bridge from clinical events to billing. A charge has at most one origin.
- Passwords are Argon2id hashes and are restricted data.
- The institution on the user determines the engine for the whole session.
- Catalogs share a structure and are copied per institution. They are not one shared database.
- Billing is simulated in quetzales with 12 percent IVA. It is not connected to a tax authority.
- Inventory stops at current stock and consumption. No purchase orders.
- Insurance is one covered amount plus the patient balance. Policies are out of scope.
- Physical SQL types (`SERIAL`, `TIMESTAMPTZ`, `AUTO_INCREMENT`, `DATETIME`) wait until Entrega II migrations. Supuesto 15.

## E1-06 attribute conflicts (Carlos, 2026-10-14)

Carlos Hugo Escobar Gómez closed the five gaps between sección 5 and sección 7.4. Agents do not reopen them.

1. **PROFESIONAL (choice B).** Leave the sección 7.4 relational schema as-is: omit `id_tipo_personal`, `modalidad_contrato`, and `fecha_ingreso` from the relational model. Sección 5.1 may still list those attributes for analysis/Chen. Correct sección 7.6 and any prose that treated `PROFESIONAL.id_tipo_personal` as a foreign key present in 7.4.
2. **CAMA (choice A).** Add `tipo_cama` and `codigo_servicio` to relational sección 7.4 and to `rel-*.mmd`. Chen 6.4.4 may already show them from sección 5.2.
3. **PACIENTE / MUNICIPIO (choice A).** Add `MUNICIPIO` to the entity inventory (sección 4) and to the relational model so `PACIENTE.id_municipio` has a real target.
4. **NOTA_EVOLUCION (choice A).** Add an optional foreign key from a note to the previous note in the relational model. A correction is a new note that references the prior one.
5. **`numero_colegiado` (Carlos accepted the coordinator recommendation).** If `TIPO_PERSONAL.requiere_colegiado` is true, `numero_colegiado` is required. Otherwise it is `NULL` (never an empty string). It is UNIQUE among non-null values; PostgreSQL and MySQL nullable UNIQUE are enough. Concrete DDL waits for Entrega II. Do not invent a compound unique key.

## Auth (Carlos, 2026-10-19)

Carlos Hugo Escobar Gómez locked Entrega II authentication. Agents do not reopen these.

1. **Login flow.** Email + password only. The user selects (and must belong to) one institution at authentication. Identity system of record remains Hospital PostgreSQL via `AuthPort` (architecture §4.2); Phase-0 uses a memory adapter behind the same port.
2. **JWT access claims (“completo”).** Exact claim set (also encoded in `@genki/shared` / server verify):
   - `sub` — usuario id (string form of `id_usuario`)
   - `email` — login email
   - `institucion_id` — numeric institution id
   - `institucion_kind` — one of the four locked kinds
   - `roles` — string array of role names
   - `motor` — engine for that institution (`postgres` | `mysql` | `mongodb` | `firebase`), from `INSTITUTION_ENGINE_ASSIGNMENTS`
   - `iat` — issued-at (seconds)
   - `exp` — expiry (seconds)
   - `typ` — literal `"access"`
3. **Password policy (“el estándar”).** Minimum 8 characters; at least one letter and one digit. Hash with **Argon2id** only (already locked above; overrides the architecture note’s “argon2/bcrypt”). No plaintext storage. Spec names no OWASP ASVS level; this baseline is the documented standard.
4. **Session (persistent).** Access JWT + refresh JWT. Defaults (spec was silent on TTLs):
   - Access TTL: **30 minutes**
   - Refresh TTL: **14 days**
   - Refresh tokens rotate on each successful refresh (`jti` replaced; previous `jti` invalidated).
   Refresh claims: `sub`, `institucion_id`, `institucion_kind`, `jti`, `iat`, `exp`, `typ: "refresh"`.

5. **Superadministrador de calificación (Carlos, 2026-11-09).** Exception for the grading engineer only: identity `superadmin@example.invalid` with role `superadministrador` lives on Hospital PostgreSQL (institution 1). After login, `POST /api/auth/select-institution` may reissue tokens whose `institucion_id` / `institucion_kind` / `motor` match any of the four locked institutions. Claim set stays the same. Normal users remain unable to change institution after login.

## How the pair works

- Humans own design. Cursor codes for Carlos. Claude codes for Jordin.
- Carlos owns Hospital general and Laboratorio clínico, plus CI and local validation when that work starts.
- Jordin owns Centro médico pediátrico and Clínica odontológica, plus the contract suite and end-to-end harness when that work starts.
- Professor-facing documents stay in Spanish. Agent protocol stays in English.
- No ORM. The architecture note forbids it because the course grades per-engine modeling. That constraint binds Entrega II, and it is not a reason to start Entrega II now.

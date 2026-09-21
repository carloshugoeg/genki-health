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

## How the pair works

- Humans own design. Cursor codes for Carlos. Claude codes for Jordin.
- Carlos owns Hospital general and Laboratorio clínico, plus CI and local validation when that work starts.
- Jordin owns Centro médico pediátrico and Clínica odontológica, plus the contract suite and end-to-end harness when that work starts.
- Professor-facing documents stay in Spanish. Agent protocol stays in English.
- No ORM. The architecture note forbids it because the course grades per-engine modeling. That constraint binds Entrega II, and it is not a reason to start Entrega II now.

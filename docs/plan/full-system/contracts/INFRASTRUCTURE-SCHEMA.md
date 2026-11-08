# F3b — Explicit infrastructure additions (not original entities)

Owner FS-BRIDGE, PG migration full-89-referral-transfer.sql / Mongo full-89-referral-transfer.ts:

```
referral_patient_map(
 origin_institution INT NOT NULL, origin_patient INT NOT NULL,
 destination_institution INT NOT NULL, destination_patient INT NOT NULL,
 referral_id INT NOT NULL, purpose VARCHAR(30) NOT NULL, created_at TIMESTAMPTZ NOT NULL,
 PRIMARY KEY(origin_institution,origin_patient,destination_institution,referral_id));
referral_result_receipt(
 origin_institution INT NOT NULL, referral_id INT NOT NULL, result_id INT NOT NULL,
 delivered_at TIMESTAMPTZ NOT NULL, payload JSONB NOT NULL, hash_sha256 CHAR(64) NOT NULL,
 PRIMARY KEY(origin_institution,referral_id,result_id));
```
PG receipt is an immutable delivered snapshot only. Mongo mapping stores the same numeric fields with institution-scoped compound key, ISO created_at/delivered_at serialization at worker boundary and BSON Date in native Mongo. Outbox schema already in entities.json, `payload` strict discriminated union order_referral / result_delivery, no arbitrary institution destination.
`order_referral={id_orden:number,origin_institution:1,destination_institution:3,origin_patient:number,identity:{tipo_documento,numero_documento,primer_nombre,primer_apellido,fecha_nacimiento,sexo},exam_codes:string[],priority:'rutina'|'urgente',requesting_professional:string}`.
`result_delivery={referral_id:number,lab_order_id:number,origin_institution:3,destination_institution:1,results:RESULTADO[]}` where all results validated/delivered and reference snapshots valid. Receipt hash calculated over canonical sorted-key JSON; replay with different hash=>409 conflict, audit no payload. Outbox states pending/leased/delivered/failed; lease expires after60sec local clock,3 tries then visible failed. Service principal may read only scoped referral purpose/mapping, never arbitrary patient registry. Destination identity must NOT be mapped by coincident numeric id.

Owner FS-SECURITY-INTEGRATION, PG migration full-91-viewer-map.sql:
```
usuario_paciente(
 id_usuario INT NOT NULL REFERENCES usuario(id_usuario),
 id_institucion INT NOT NULL REFERENCES institucion(id_institucion),
 id_paciente_clinico INT NOT NULL,
 PRIMARY KEY(id_usuario,id_institucion));
usuario_profesional_vinculo(
 id_usuario INT NOT NULL REFERENCES usuario(id_usuario),
 id_institucion INT NOT NULL REFERENCES institucion(id_institucion),
 id_profesional_clinico INT NOT NULL,
 PRIMARY KEY(id_usuario,id_institucion));
```
Clinical ids validated through correct scoped clinical port before mapping grant; no cross-engine FK, no change to existing PG usuario.id_profesional FK or JWT claims. Own-patient/own-honorarium access resolves these explicit maps; missing binding=>403, never user.id==patient.id shortcut. Mapping admin action is part of OP05 user administration with explicit body optional `vinculo_paciente:{id_paciente:number}` / `vinculo_profesional:{id_profesional:number}`, owner admin only, target's institution must equal user institution. Include mapping audit and denied foreign fixture.

Owner FS-06 agenda native migration:
`agenda_lock(id_institucion INT,id_profesional INT,fecha DATE,PRIMARY KEY(id_institucion,id_profesional,fecha))`. Acquire professional/day locks ascending date, max duration480min and query max31days; duration min1 max480, no scheduling in past. Firestore/Mongo lock documents same key, update revision to serialize bookings/reprogramming; Mongo indexed bounded overlap scan inside session. Arrival confirmada, attendance handled on consultation close.

Owner FS-13 vaccines native migration:
DOSIS schedule derived rows, version_esquema VARCHAR(40) NOT NULL on dosis_vacuna, copied official interval manifest version, required in DTO. Reactions source field max300 with prior value in restricted audit fragment only (no clinical text in general BITACORA). Current appointment/clinical cancel reasons use dedicated `accion_motivo` metadata max300 in safe-authorized record, general audit holds field names only.

Owner FS-23 charges native migration:
CARGO clave_evento and motive metadata already in schema-additions. Each original activity emits one stable charge event key, e.g. `consulta:<id>:consulta`, `consumo:<id>`, `admision:<id>:estancia`, `participacion:<id>`, `sesion:<id>:linea:<line>`. Unique per institution; identical retry returns original, different payload hash=>409. Generated clinical service description snapshots remain confidential; Caja projection uses service public name only, not free clinical diagnosis text.

Literal NEW-TABLES SQL files define exact new source columns. They deliberately don't pretend to be a complete runnable migration: source FKs in SOURCE-FKS.json and F3 constraints, ALTER metadata/backfills and source role grants must be added by assigned tickets before final native gate. Do not execute a planning SQL file as an unaudited bootstrap script.

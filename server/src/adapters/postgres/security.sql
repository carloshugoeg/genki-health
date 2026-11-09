-- C5.3 least-privilege runtime groups. Execute as the migration owner after migrations.
DO $$
BEGIN
  CREATE ROLE genki_app NOLOGIN;
EXCEPTION WHEN duplicate_object THEN
  ALTER ROLE genki_app NOLOGIN;
END $$;
DO $$
BEGIN
  CREATE ROLE genki_identity NOLOGIN;
EXCEPTION WHEN duplicate_object THEN
  ALTER ROLE genki_identity NOLOGIN;
END $$;
DO $$
BEGIN
  CREATE ROLE genki_report NOLOGIN;
EXCEPTION WHEN duplicate_object THEN
  ALTER ROLE genki_report NOLOGIN;
END $$;

REVOKE ALL ON SCHEMA public FROM PUBLIC;
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM PUBLIC;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM PUBLIC;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA public FROM PUBLIC;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM PUBLIC;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON SEQUENCES FROM PUBLIC;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON FUNCTIONS FROM PUBLIC;

REVOKE ALL ON ALL TABLES IN SCHEMA public FROM genki_app, genki_identity, genki_report;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM genki_app, genki_identity, genki_report;
GRANT USAGE ON SCHEMA public TO genki_app, genki_identity, genki_report;

GRANT SELECT ON municipio, especialidad, profesional, catalogo_cie10, medicamento,
  servicio, servicio_facturable TO genki_app;
GRANT SELECT, INSERT ON paciente, responsable, consulta, diagnostico, tratamiento, receta,
  detalle_receta, antecedente, alergia, documento_adjunto, signos_vitales, consulta_borrador,
  nota_evolucion TO genki_app;
GRANT SELECT, INSERT, UPDATE ON expediente, id_counter, cama, admision TO genki_app;
GRANT USAGE, SELECT ON SEQUENCE paciente_id_paciente_seq, responsable_id_responsable_seq,
  expediente_id_expediente_seq, consulta_id_consulta_seq, diagnostico_id_diagnostico_seq,
  tratamiento_id_tratamiento_seq, receta_id_receta_seq,
  antecedente_id_antecedente_seq, alergia_id_alergia_seq, documento_adjunto_id_documento_seq,
  signos_vitales_id_signos_seq, cama_id_cama_seq, admision_id_admision_seq,
  nota_evolucion_id_nota_seq TO genki_app;

GRANT SELECT ON usuario, rol, institucion, auth_session TO genki_identity;
GRANT INSERT ON auth_session TO genki_identity;
GRANT UPDATE (revoked_at) ON auth_session TO genki_identity;
GRANT UPDATE (hash_contrasena, estado, intentos_fallidos, id_rol, id_profesional, nombre_usuario, correo, ultimo_acceso)
  ON usuario TO genki_identity;
GRANT INSERT ON usuario TO genki_identity;
DO $$ BEGIN
  GRANT UPDATE (debe_cambiar_contrasena, auth_version) ON usuario TO genki_identity;
EXCEPTION WHEN undefined_column THEN NULL; END $$;
DO $$ BEGIN
  GRANT UPDATE ON auth_session TO genki_identity;
EXCEPTION WHEN undefined_table THEN NULL; END $$;
DO $$ BEGIN
  GRANT SELECT, INSERT ON bitacora TO genki_identity;
  GRANT USAGE, SELECT ON SEQUENCE bitacora_id_bitacora_seq TO genki_identity;
EXCEPTION WHEN undefined_table THEN NULL; END $$;
DO $$ BEGIN
  GRANT SELECT ON permiso, rol_permiso TO genki_identity;
EXCEPTION WHEN undefined_table THEN NULL; END $$;
DO $$ BEGIN
  GRANT SELECT, INSERT ON reactivacion_audit TO genki_app;
  GRANT USAGE, SELECT ON SEQUENCE reactivacion_audit_id_reactivacion_seq TO genki_app;
EXCEPTION WHEN undefined_table THEN NULL; END $$;

GRANT SELECT ON reporte_pacientes TO genki_report;

DO $$ BEGIN GRANT SELECT, INSERT, UPDATE ON lane_a_locks TO genki_app; EXCEPTION WHEN undefined_table THEN NULL; END $$;
DO $$ BEGIN GRANT SELECT, INSERT, UPDATE ON lane_a_charges TO genki_app; EXCEPTION WHEN undefined_table THEN NULL; END $$;
DO $$ BEGIN GRANT SELECT, INSERT, UPDATE ON lane_a_services TO genki_app; EXCEPTION WHEN undefined_table THEN NULL; END $$;
DO $$ BEGIN GRANT SELECT, INSERT, UPDATE ON lane_a_charge_events TO genki_app; EXCEPTION WHEN undefined_table THEN NULL; END $$;
DO $$ BEGIN GRANT SELECT, INSERT, UPDATE ON lane_a_audit TO genki_app; EXCEPTION WHEN undefined_table THEN NULL; END $$;
DO $$ BEGIN GRANT SELECT, INSERT, UPDATE ON lane_a_counters TO genki_app; EXCEPTION WHEN undefined_table THEN NULL; END $$;
DO $$ BEGIN GRANT SELECT, INSERT, UPDATE ON lane_a_commands TO genki_app; EXCEPTION WHEN undefined_table THEN NULL; END $$;
DO $$ BEGIN GRANT SELECT, INSERT, UPDATE ON lane_a_participations TO genki_app; EXCEPTION WHEN undefined_table THEN NULL; END $$;
DO $$ BEGIN GRANT SELECT, INSERT, UPDATE ON lane_a_roles TO genki_app; EXCEPTION WHEN undefined_table THEN NULL; END $$;
DO $$ BEGIN GRANT SELECT, INSERT, UPDATE ON lane_a_honoraria_snapshots TO genki_app; EXCEPTION WHEN undefined_table THEN NULL; END $$;
DO $$ BEGIN GRANT SELECT, INSERT, UPDATE ON lane_a_supplies TO genki_app; EXCEPTION WHEN undefined_table THEN NULL; END $$;
DO $$ BEGIN GRANT SELECT, INSERT, UPDATE ON lane_a_consumptions TO genki_app; EXCEPTION WHEN undefined_table THEN NULL; END $$;
DO $$ BEGIN GRANT SELECT, INSERT, UPDATE ON lane_a_metadata TO genki_app; EXCEPTION WHEN undefined_table THEN NULL; END $$;
DO $$ BEGIN GRANT SELECT, INSERT, UPDATE ON lane_a_invoices TO genki_app; EXCEPTION WHEN undefined_table THEN NULL; END $$;
DO $$ BEGIN GRANT SELECT, INSERT, UPDATE ON lane_a_invoice_lines TO genki_app; EXCEPTION WHEN undefined_table THEN NULL; END $$;
DO $$ BEGIN GRANT SELECT, INSERT, UPDATE ON lane_a_payments TO genki_app; EXCEPTION WHEN undefined_table THEN NULL; END $$;
DO $$ BEGIN GRANT SELECT, INSERT, UPDATE ON lane_a_professionals TO genki_app; EXCEPTION WHEN undefined_table THEN NULL; END $$;
DO $$ BEGIN GRANT SELECT, INSERT, UPDATE ON lane_a_contracts TO genki_app; EXCEPTION WHEN undefined_table THEN NULL; END $$;
DO $$ BEGIN GRANT SELECT, INSERT, UPDATE ON lane_a_personnel_types TO genki_app; EXCEPTION WHEN undefined_table THEN NULL; END $$;
DO $$ BEGIN GRANT SELECT, INSERT, UPDATE ON lane_a_tariffs TO genki_app; EXCEPTION WHEN undefined_table THEN NULL; END $$;
DO $$ BEGIN GRANT SELECT, INSERT, UPDATE ON agenda_cita TO genki_app; EXCEPTION WHEN undefined_table THEN NULL; END $$;
DO $$ BEGIN GRANT USAGE, SELECT ON SEQUENCE agenda_cita_id_cita_seq TO genki_app; EXCEPTION WHEN undefined_table THEN NULL; END $$;
DO $$ BEGIN GRANT SELECT ON catalogo_procedimiento TO genki_app; EXCEPTION WHEN undefined_table THEN NULL; END $$;
DO $$ BEGIN GRANT SELECT, INSERT ON procedimiento TO genki_app; EXCEPTION WHEN undefined_table THEN NULL; END $$;
DO $$ BEGIN GRANT USAGE, SELECT ON SEQUENCE procedimiento_id_procedimiento_seq TO genki_app; EXCEPTION WHEN undefined_table THEN NULL; END $$;

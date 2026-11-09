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

GRANT SELECT ON reporte_pacientes TO genki_report;

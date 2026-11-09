-- C5.3 MySQL least-privilege roles. Passwords and login users live in bootstrap/TS.
-- Placeholder __DATABASE__ is replaced by installMysqlSecurity for the target schema.
CREATE ROLE IF NOT EXISTS `genki_app`;
CREATE ROLE IF NOT EXISTS `genki_report`;

GRANT SELECT ON `__DATABASE__`.`municipio` TO `genki_app`;
GRANT SELECT ON `__DATABASE__`.`especialidad` TO `genki_app`;
GRANT SELECT ON `__DATABASE__`.`profesional` TO `genki_app`;
GRANT SELECT ON `__DATABASE__`.`catalogo_cie10` TO `genki_app`;
GRANT SELECT ON `__DATABASE__`.`medicamento` TO `genki_app`;
GRANT SELECT ON `__DATABASE__`.`institucion` TO `genki_app`;
GRANT SELECT ON `__DATABASE__`.`tipo_personal` TO `genki_app`;
GRANT SELECT ON `__DATABASE__`.`vacuna` TO `genki_app`;
GRANT SELECT ON `__DATABASE__`.`vacuna_intervalo` TO `genki_app`;
GRANT SELECT ON `__DATABASE__`.`hito_desarrollo` TO `genki_app`;
GRANT SELECT ON `__DATABASE__`.`referencia_oms` TO `genki_app`;

GRANT SELECT, INSERT ON `__DATABASE__`.`paciente` TO `genki_app`;
GRANT SELECT, INSERT ON `__DATABASE__`.`responsable` TO `genki_app`;
GRANT SELECT, INSERT ON `__DATABASE__`.`consulta` TO `genki_app`;
GRANT SELECT, INSERT ON `__DATABASE__`.`diagnostico` TO `genki_app`;
GRANT SELECT, INSERT ON `__DATABASE__`.`tratamiento` TO `genki_app`;
GRANT SELECT, INSERT ON `__DATABASE__`.`receta` TO `genki_app`;
GRANT SELECT, INSERT ON `__DATABASE__`.`detalle_receta` TO `genki_app`;
GRANT SELECT, INSERT ON `__DATABASE__`.`antecedente` TO `genki_app`;
GRANT SELECT, INSERT ON `__DATABASE__`.`alergia` TO `genki_app`;
GRANT SELECT, INSERT ON `__DATABASE__`.`documento_adjunto` TO `genki_app`;
GRANT SELECT, INSERT ON `__DATABASE__`.`signos_vitales` TO `genki_app`;
GRANT SELECT, INSERT ON `__DATABASE__`.`consulta_borrador` TO `genki_app`;
GRANT SELECT, INSERT ON `__DATABASE__`.`medicion_antropometrica` TO `genki_app`;
GRANT SELECT, INSERT, UPDATE ON `__DATABASE__`.`expediente` TO `genki_app`;
GRANT SELECT, INSERT, UPDATE ON `__DATABASE__`.`id_counter` TO `genki_app`;
GRANT SELECT, INSERT, UPDATE ON `__DATABASE__`.`antecedente_perinatal` TO `genki_app`;
GRANT SELECT, INSERT, UPDATE ON `__DATABASE__`.`dosis_vacuna` TO `genki_app`;
GRANT SELECT, INSERT, UPDATE ON `__DATABASE__`.`seguimiento_hito` TO `genki_app`;

GRANT SELECT ON `__DATABASE__`.`reporte_pacientes` TO `genki_report`;

GRANT SELECT, INSERT, UPDATE ON `__DATABASE__`.`lane_a_locks` TO `genki_app`;
GRANT SELECT, INSERT, UPDATE ON `__DATABASE__`.`lane_a_charges` TO `genki_app`;
GRANT SELECT, INSERT, UPDATE ON `__DATABASE__`.`lane_a_services` TO `genki_app`;
GRANT SELECT, INSERT, UPDATE ON `__DATABASE__`.`lane_a_charge_events` TO `genki_app`;
GRANT SELECT, INSERT, UPDATE ON `__DATABASE__`.`lane_a_audit` TO `genki_app`;
GRANT SELECT, INSERT, UPDATE ON `__DATABASE__`.`lane_a_counters` TO `genki_app`;
GRANT SELECT, INSERT, UPDATE ON `__DATABASE__`.`lane_a_commands` TO `genki_app`;
GRANT SELECT, INSERT, UPDATE ON `__DATABASE__`.`lane_a_participations` TO `genki_app`;
GRANT SELECT, INSERT, UPDATE ON `__DATABASE__`.`lane_a_roles` TO `genki_app`;
GRANT SELECT, INSERT, UPDATE ON `__DATABASE__`.`lane_a_honoraria_snapshots` TO `genki_app`;
GRANT SELECT, INSERT, UPDATE ON `__DATABASE__`.`lane_a_supplies` TO `genki_app`;
GRANT SELECT, INSERT, UPDATE ON `__DATABASE__`.`lane_a_consumptions` TO `genki_app`;
GRANT SELECT, INSERT, UPDATE ON `__DATABASE__`.`lane_a_metadata` TO `genki_app`;
GRANT SELECT, INSERT, UPDATE ON `__DATABASE__`.`lane_a_invoices` TO `genki_app`;
GRANT SELECT, INSERT, UPDATE ON `__DATABASE__`.`lane_a_invoice_lines` TO `genki_app`;
GRANT SELECT, INSERT, UPDATE ON `__DATABASE__`.`lane_a_payments` TO `genki_app`;
GRANT SELECT, INSERT, UPDATE ON `__DATABASE__`.`lane_a_professionals` TO `genki_app`;
GRANT SELECT, INSERT, UPDATE ON `__DATABASE__`.`lane_a_contracts` TO `genki_app`;
GRANT SELECT, INSERT, UPDATE ON `__DATABASE__`.`lane_a_personnel_types` TO `genki_app`;
GRANT SELECT, INSERT, UPDATE ON `__DATABASE__`.`lane_a_tariffs` TO `genki_app`;
GRANT SELECT, INSERT, UPDATE ON `__DATABASE__`.`agenda_cita` TO `genki_app`;
GRANT SELECT, INSERT, UPDATE ON `__DATABASE__`.`agenda_lock` TO `genki_app`;
GRANT SELECT, INSERT, UPDATE ON `__DATABASE__`.`agenda_cita_id` TO `genki_app`;

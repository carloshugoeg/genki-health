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

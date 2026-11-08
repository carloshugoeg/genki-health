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

GRANT SELECT, INSERT ON `__DATABASE__`.`paciente` TO `genki_app`;
GRANT SELECT, INSERT ON `__DATABASE__`.`responsable` TO `genki_app`;
GRANT SELECT, INSERT ON `__DATABASE__`.`consulta` TO `genki_app`;
GRANT SELECT, INSERT ON `__DATABASE__`.`diagnostico` TO `genki_app`;
GRANT SELECT, INSERT ON `__DATABASE__`.`tratamiento` TO `genki_app`;
GRANT SELECT, INSERT ON `__DATABASE__`.`receta` TO `genki_app`;
GRANT SELECT, INSERT ON `__DATABASE__`.`detalle_receta` TO `genki_app`;
GRANT SELECT, INSERT, UPDATE ON `__DATABASE__`.`expediente` TO `genki_app`;
GRANT SELECT, INSERT, UPDATE ON `__DATABASE__`.`id_counter` TO `genki_app`;

GRANT SELECT ON `__DATABASE__`.`reporte_pacientes` TO `genki_report`;

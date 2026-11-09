-- Mantenimiento de historiales (cierre OP-31, corrección/anulación con bitácora), Centro pediátrico.
-- Driver-friendly (no DELIMITER), additive and idempotent: safe to re-run.
-- Widens three CHECKs to the Entrega I status domains so an annulment is a status change, never a
-- DELETE. 0001-core declared them inline, so MySQL auto-named them (<table>_chk_N); they are found
-- by their CHECK_CLAUSE, dropped, and replaced by named constraints:
--   DIAGNOSTICO.tipo   presuntivo, definitivo, descartado   (anular -> descartado)
--   TRATAMIENTO.estado activo (= vigente), finalizado, suspendido (anular -> suspendido)
--   RECETA.estado      emitida, anulada                     (anular -> anulada)
-- Also creates BITACORA (Entrega I) next to the clinical rows so the audit row commits atomically
-- with the change. id_usuario has no FK: USUARIO lives in the Hospital PostgreSQL identity store.

-- DIAGNOSTICO.tipo ------------------------------------------------------------------------------
SET @chk := (
  SELECT cc.CONSTRAINT_NAME
    FROM INFORMATION_SCHEMA.CHECK_CONSTRAINTS cc
    JOIN INFORMATION_SCHEMA.TABLE_CONSTRAINTS tc
      ON tc.CONSTRAINT_SCHEMA = cc.CONSTRAINT_SCHEMA AND tc.CONSTRAINT_NAME = cc.CONSTRAINT_NAME
   WHERE cc.CONSTRAINT_SCHEMA = DATABASE()
     AND tc.TABLE_NAME = 'diagnostico'
     AND tc.CONSTRAINT_TYPE = 'CHECK'
     AND cc.CHECK_CLAUSE LIKE '%`tipo`%presuntivo%'
     AND (cc.CONSTRAINT_NAME <> 'diagnostico_tipo_check' OR cc.CHECK_CLAUSE NOT LIKE '%descartado%')
   LIMIT 1
);
SET @sql := IF(@chk IS NULL, 'SELECT 1', CONCAT('ALTER TABLE diagnostico DROP CHECK `', @chk, '`'));
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @exist := (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS
   WHERE TABLE_SCHEMA = DATABASE()
     AND TABLE_NAME = 'diagnostico'
     AND CONSTRAINT_NAME = 'diagnostico_tipo_check'
);
SET @sql := IF(
  @exist = 0,
  'ALTER TABLE diagnostico ADD CONSTRAINT diagnostico_tipo_check CHECK (tipo IN (''presuntivo'', ''definitivo'', ''descartado''))',
  'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- TRATAMIENTO.estado ----------------------------------------------------------------------------
SET @chk := (
  SELECT cc.CONSTRAINT_NAME
    FROM INFORMATION_SCHEMA.CHECK_CONSTRAINTS cc
    JOIN INFORMATION_SCHEMA.TABLE_CONSTRAINTS tc
      ON tc.CONSTRAINT_SCHEMA = cc.CONSTRAINT_SCHEMA AND tc.CONSTRAINT_NAME = cc.CONSTRAINT_NAME
   WHERE cc.CONSTRAINT_SCHEMA = DATABASE()
     AND tc.TABLE_NAME = 'tratamiento'
     AND tc.CONSTRAINT_TYPE = 'CHECK'
     AND cc.CHECK_CLAUSE LIKE '%`estado`%activo%'
     AND (cc.CONSTRAINT_NAME <> 'tratamiento_estado_check' OR cc.CHECK_CLAUSE NOT LIKE '%suspendido%')
   LIMIT 1
);
SET @sql := IF(@chk IS NULL, 'SELECT 1', CONCAT('ALTER TABLE tratamiento DROP CHECK `', @chk, '`'));
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @exist := (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS
   WHERE TABLE_SCHEMA = DATABASE()
     AND TABLE_NAME = 'tratamiento'
     AND CONSTRAINT_NAME = 'tratamiento_estado_check'
);
SET @sql := IF(
  @exist = 0,
  'ALTER TABLE tratamiento ADD CONSTRAINT tratamiento_estado_check CHECK (estado IN (''activo'', ''finalizado'', ''suspendido''))',
  'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- RECETA.estado ---------------------------------------------------------------------------------
SET @chk := (
  SELECT cc.CONSTRAINT_NAME
    FROM INFORMATION_SCHEMA.CHECK_CONSTRAINTS cc
    JOIN INFORMATION_SCHEMA.TABLE_CONSTRAINTS tc
      ON tc.CONSTRAINT_SCHEMA = cc.CONSTRAINT_SCHEMA AND tc.CONSTRAINT_NAME = cc.CONSTRAINT_NAME
   WHERE cc.CONSTRAINT_SCHEMA = DATABASE()
     AND tc.TABLE_NAME = 'receta'
     AND tc.CONSTRAINT_TYPE = 'CHECK'
     AND cc.CHECK_CLAUSE LIKE '%`estado`%emitida%'
     AND (cc.CONSTRAINT_NAME <> 'receta_estado_check' OR cc.CHECK_CLAUSE NOT LIKE '%anulada%')
   LIMIT 1
);
SET @sql := IF(@chk IS NULL, 'SELECT 1', CONCAT('ALTER TABLE receta DROP CHECK `', @chk, '`'));
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @exist := (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS
   WHERE TABLE_SCHEMA = DATABASE()
     AND TABLE_NAME = 'receta'
     AND CONSTRAINT_NAME = 'receta_estado_check'
);
SET @sql := IF(
  @exist = 0,
  'ALTER TABLE receta ADD CONSTRAINT receta_estado_check CHECK (estado IN (''emitida'', ''anulada''))',
  'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- BITACORA (Entrega I) --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS bitacora (
  id_bitacora BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  id_institucion INT NOT NULL,
  id_usuario INT NOT NULL,
  entidad VARCHAR(40) NOT NULL,
  id_registro VARCHAR(40) NOT NULL,
  accion VARCHAR(15) NOT NULL,
  fecha_hora DATETIME(3) NOT NULL,
  direccion_ip VARCHAR(45) NULL,
  detalle JSON NULL,
  INDEX idx_bitacora_registro (entidad, id_registro, fecha_hora)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_as_ci;

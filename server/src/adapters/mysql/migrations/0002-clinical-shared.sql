-- Lane-1 clinical shared: open consultations, vitals, record, attachments.
-- Idempotent for disposable loopback databases where possible.

SET @db := DATABASE();

DROP PROCEDURE IF EXISTS genki_drop_consulta_checks;
DELIMITER //
CREATE PROCEDURE genki_drop_consulta_checks()
BEGIN
  DECLARE done INT DEFAULT 0;
  DECLARE cname VARCHAR(64);
  DECLARE cur CURSOR FOR
    SELECT CONSTRAINT_NAME
      FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = 'consulta'
       AND CONSTRAINT_TYPE = 'CHECK';
  DECLARE CONTINUE HANDLER FOR NOT FOUND SET done = 1;
  OPEN cur;
  read_loop: LOOP
    FETCH cur INTO cname;
    IF done = 1 THEN
      LEAVE read_loop;
    END IF;
    SET @ddl = CONCAT('ALTER TABLE consulta DROP CHECK `', cname, '`');
    PREPARE stmt FROM @ddl;
    EXECUTE stmt;
    DEALLOCATE PREPARE stmt;
  END LOOP;
  CLOSE cur;
END //
DELIMITER ;
CALL genki_drop_consulta_checks();
DROP PROCEDURE IF EXISTS genki_drop_consulta_checks;

ALTER TABLE consulta
  MODIFY fecha_hora_fin DATETIME(3) NULL,
  ADD CONSTRAINT consulta_tipo_check CHECK (tipo IN ('primera_vez', 'seguimiento', 'emergencia')),
  ADD CONSTRAINT consulta_estado_check CHECK (estado IN ('abierta', 'cerrada', 'anulada')),
  ADD CONSTRAINT consulta_fin_check CHECK (
    fecha_hora_fin IS NULL OR fecha_hora_fin >= fecha_hora_inicio
  ),
  ADD CONSTRAINT consulta_id_cita_null_check CHECK (id_cita IS NULL);

CREATE TABLE IF NOT EXISTS antecedente (
  id_institucion INTEGER NOT NULL,
  id_antecedente INTEGER NOT NULL AUTO_INCREMENT,
  id_expediente INTEGER NOT NULL,
  tipo VARCHAR(20) NOT NULL,
  descripcion VARCHAR(300) NOT NULL,
  fecha_inicio DATE NULL,
  vigente BOOLEAN NOT NULL,
  fecha_registro DATETIME(3) NOT NULL,
  PRIMARY KEY (id_institucion, id_antecedente),
  UNIQUE KEY uq_antecedente_id (id_antecedente),
  CONSTRAINT fk_antecedente_expediente FOREIGN KEY (id_expediente) REFERENCES expediente (id_expediente) ON DELETE RESTRICT,
  CHECK (tipo IN ('personal', 'familiar', 'quirurgico', 'habito'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_as_ci;

CREATE TABLE IF NOT EXISTS alergia (
  id_institucion INTEGER NOT NULL,
  id_alergia INTEGER NOT NULL AUTO_INCREMENT,
  id_expediente INTEGER NOT NULL,
  sustancia VARCHAR(120) NOT NULL,
  sustancia_norm VARCHAR(120) NOT NULL,
  tipo VARCHAR(20) NOT NULL,
  severidad VARCHAR(15) NOT NULL,
  reaccion VARCHAR(200) NULL,
  fecha_deteccion DATE NULL,
  PRIMARY KEY (id_institucion, id_alergia),
  UNIQUE KEY uq_alergia_id (id_alergia),
  UNIQUE KEY uq_alergia_sustancia (id_institucion, id_expediente, sustancia_norm),
  CONSTRAINT fk_alergia_expediente FOREIGN KEY (id_expediente) REFERENCES expediente (id_expediente) ON DELETE RESTRICT,
  CHECK (tipo IN ('medicamento', 'alimento', 'ambiental', 'otro')),
  CHECK (severidad IN ('leve', 'moderada', 'severa'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_as_ci;

CREATE TABLE IF NOT EXISTS documento_adjunto (
  id_institucion INTEGER NOT NULL,
  id_documento INTEGER NOT NULL AUTO_INCREMENT,
  id_expediente INTEGER NOT NULL,
  id_consulta INTEGER NULL,
  nombre_archivo VARCHAR(160) NOT NULL,
  tipo_mime VARCHAR(60) NOT NULL,
  ruta VARCHAR(300) NOT NULL,
  hash_sha256 CHAR(64) NOT NULL,
  fecha_carga DATETIME(3) NOT NULL,
  contenido LONGBLOB NOT NULL,
  PRIMARY KEY (id_institucion, id_documento),
  UNIQUE KEY uq_documento_id (id_documento),
  CONSTRAINT fk_documento_expediente FOREIGN KEY (id_expediente) REFERENCES expediente (id_expediente) ON DELETE RESTRICT,
  CONSTRAINT fk_documento_consulta FOREIGN KEY (id_consulta) REFERENCES consulta (id_consulta) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_as_ci;

CREATE TABLE IF NOT EXISTS signos_vitales (
  id_institucion INTEGER NOT NULL,
  id_signos INTEGER NOT NULL AUTO_INCREMENT,
  id_consulta INTEGER NOT NULL,
  fecha_hora_toma DATETIME(3) NOT NULL,
  presion_sistolica SMALLINT NULL,
  presion_diastolica SMALLINT NULL,
  frecuencia_cardiaca SMALLINT NULL,
  frecuencia_respiratoria SMALLINT NULL,
  temperatura_c DECIMAL(4, 1) NULL,
  saturacion_oxigeno SMALLINT NULL,
  peso_kg DECIMAL(5, 2) NULL,
  talla_cm DECIMAL(5, 1) NULL,
  PRIMARY KEY (id_institucion, id_signos),
  UNIQUE KEY uq_signos_id (id_signos),
  UNIQUE KEY uq_signos_consulta (id_institucion, id_consulta),
  CONSTRAINT fk_signos_consulta FOREIGN KEY (id_consulta) REFERENCES consulta (id_consulta) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_as_ci;

CREATE TABLE IF NOT EXISTS consulta_borrador (
  id_institucion INTEGER NOT NULL,
  id_consulta INTEGER NOT NULL,
  bundle JSON NOT NULL,
  revision INTEGER NOT NULL,
  PRIMARY KEY (id_institucion, id_consulta),
  CONSTRAINT fk_borrador_consulta FOREIGN KEY (id_consulta) REFERENCES consulta (id_consulta) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_as_ci;

-- FS-04-MY03: append-only audit for OP-19 reactivation.
CREATE TABLE IF NOT EXISTS reactivacion_audit (
  id_institucion INT NOT NULL,
  id_reactivacion BIGINT NOT NULL AUTO_INCREMENT,
  id_expediente INT NOT NULL,
  id_usuario INT NOT NULL,
  motivo VARCHAR(300) NOT NULL,
  fecha_hora DATETIME(3) NOT NULL,
  fecha_archivo_previa DATETIME(3) NULL,
  motivo_archivo_previo VARCHAR(20) NULL,
  observacion_archivo_previa VARCHAR(500) NULL,
  PRIMARY KEY (id_institucion, id_reactivacion),
  UNIQUE KEY uq_reactivacion_audit_id (id_reactivacion)
);

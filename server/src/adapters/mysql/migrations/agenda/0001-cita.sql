-- UTC DATETIME(3); module-local, repeatable, no hospital-only entities.
CREATE TABLE IF NOT EXISTS agenda_cita (
  id_institucion INTEGER NOT NULL,
  id_cita INTEGER NOT NULL AUTO_INCREMENT,
  id_paciente INTEGER NOT NULL,
  id_profesional INTEGER NOT NULL,
  id_especialidad INTEGER NULL,
  fecha_hora DATETIME(3) NOT NULL,
  duracion_minutos SMALLINT NOT NULL CHECK (duracion_minutos > 0),
  motivo VARCHAR(200) NULL,
  estado VARCHAR(20) NOT NULL CHECK (estado IN ('programada','confirmada','atendida','cancelada','no_asistio')),
  id_usuario_registra INTEGER NOT NULL,
  fecha_creacion DATETIME(3) NOT NULL,
  PRIMARY KEY (id_institucion,id_cita),
  UNIQUE KEY agenda_cita_generated (id_cita),
  INDEX agenda_cita_day (id_institucion,id_profesional,fecha_hora)
) ENGINE=InnoDB;
CREATE TABLE IF NOT EXISTS agenda_lock (lock_key VARCHAR(160) PRIMARY KEY) ENGINE=InnoDB;

-- Native auto-increment allocator; no shared application mutex.
CREATE TABLE IF NOT EXISTS agenda_cita_id (id INTEGER NOT NULL AUTO_INCREMENT PRIMARY KEY) ENGINE=InnoDB;

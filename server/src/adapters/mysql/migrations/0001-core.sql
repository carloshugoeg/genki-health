-- Frozen C4b. MySQL 8.4; execute with migration owner, never the runtime role.
-- All table names lowercase; wire DTO names unchanged. No clinical DELETE privilege.
CREATE TABLE institucion (
 id_institucion INTEGER PRIMARY KEY, nombre VARCHAR(120) NOT NULL UNIQUE,
 tipo VARCHAR(40) NOT NULL, nit VARCHAR(25) NOT NULL UNIQUE, direccion VARCHAR(250) NOT NULL,
 telefono VARCHAR(25) NOT NULL, correo VARCHAR(120) NOT NULL, motor_datos VARCHAR(12) NOT NULL,
 activo BOOLEAN NOT NULL DEFAULT TRUE,
 CHECK (motor_datos IN ('postgres','mysql','mongodb','firebase'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_as_ci;
CREATE TABLE municipio (id_municipio INTEGER PRIMARY KEY, nombre VARCHAR(100) NOT NULL UNIQUE) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_as_ci;
CREATE TABLE especialidad (id_especialidad INTEGER PRIMARY KEY, nombre VARCHAR(100) NOT NULL UNIQUE, descripcion TEXT) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_as_ci;
CREATE TABLE tipo_personal (id_tipo_personal INTEGER PRIMARY KEY, nombre VARCHAR(80) NOT NULL UNIQUE,
 requiere_colegiado BOOLEAN NOT NULL, genera_honorario BOOLEAN NOT NULL) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_as_ci;
CREATE TABLE profesional (
 id_profesional INTEGER AUTO_INCREMENT PRIMARY KEY,
 id_institucion INTEGER NOT NULL,
 id_especialidad INTEGER,
 numero_colegiado VARCHAR(30) UNIQUE, nombres VARCHAR(120) NOT NULL, apellidos VARCHAR(120) NOT NULL,
 telefono VARCHAR(25), correo VARCHAR(120), activo BOOLEAN NOT NULL DEFAULT TRUE,
 CHECK(numero_colegiado IS NULL OR length(trim(numero_colegiado))>0)
,
 FOREIGN KEY (id_institucion) REFERENCES institucion(id_institucion) ON DELETE RESTRICT,
 FOREIGN KEY (id_especialidad) REFERENCES especialidad(id_especialidad) ON DELETE RESTRICT) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_as_ci;
-- Locked B: no id_tipo_personal, modalidad_contrato or fecha_ingreso on profesional.
CREATE TABLE paciente (
 id_paciente INTEGER AUTO_INCREMENT PRIMARY KEY,
 id_institucion INTEGER NOT NULL,
 tipo_documento VARCHAR(20) NOT NULL, numero_documento VARCHAR(25) NOT NULL,
 primer_nombre VARCHAR(60) NOT NULL, segundo_nombre VARCHAR(60), primer_apellido VARCHAR(60) NOT NULL,
 segundo_apellido VARCHAR(60), fecha_nacimiento DATE NOT NULL, sexo CHAR(1) NOT NULL,
 tipo_sangre VARCHAR(5), telefono VARCHAR(25), correo VARCHAR(120), direccion VARCHAR(250),
 id_municipio INTEGER,
 fecha_registro DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
 estado VARCHAR(10) NOT NULL DEFAULT 'activo',
 CONSTRAINT uq_paciente_documento UNIQUE(id_institucion,numero_documento), CHECK(sexo IN ('M','F','X')),
 CHECK(estado IN ('activo','inactivo')), CHECK(length(trim(numero_documento))>0)
,
 FOREIGN KEY (id_institucion) REFERENCES institucion(id_institucion) ON DELETE RESTRICT,
 FOREIGN KEY (id_municipio) REFERENCES municipio(id_municipio) ON DELETE RESTRICT) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_as_ci;
CREATE INDEX ix_paciente_names ON paciente(id_institucion,primer_apellido,primer_nombre,id_paciente);
CREATE TABLE expediente (
 id_expediente INTEGER AUTO_INCREMENT PRIMARY KEY,
 id_paciente INTEGER NOT NULL UNIQUE,
 numero_expediente VARCHAR(30) NOT NULL UNIQUE, fecha_apertura DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
 estado VARCHAR(10) NOT NULL DEFAULT 'activo', fecha_archivo DATETIME(3),
 motivo_archivo VARCHAR(20), observacion_archivo VARCHAR(500),
 CHECK(estado IN ('activo','archivado')),
 CHECK(motivo_archivo IS NULL OR motivo_archivo IN ('traslado','fallecimiento','administrativo','inactividad')),
 CHECK((estado='activo' AND fecha_archivo IS NULL AND motivo_archivo IS NULL AND observacion_archivo IS NULL)
 OR (estado='archivado' AND fecha_archivo IS NOT NULL AND motivo_archivo IS NOT NULL))
,
 FOREIGN KEY (id_paciente) REFERENCES paciente(id_paciente) ON DELETE RESTRICT) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_as_ci;
CREATE INDEX ix_expediente_estado ON expediente(estado,id_paciente);
-- Helper used by the portable contract suite; production guardian flow is pediatric only.
CREATE TABLE responsable (
 id_responsable INTEGER AUTO_INCREMENT PRIMARY KEY,
 id_paciente INTEGER NOT NULL,
 tipo_documento VARCHAR(20) NOT NULL, numero_documento VARCHAR(25) NOT NULL,
 nombre_completo VARCHAR(150) NOT NULL, parentesco VARCHAR(25) NOT NULL,
 telefono VARCHAR(25) NOT NULL, correo VARCHAR(120), direccion VARCHAR(250), es_principal BOOLEAN NOT NULL,
 CHECK(parentesco IN ('madre','padre','abuelo','tutor_legal','otro'))
,
 FOREIGN KEY (id_paciente) REFERENCES paciente(id_paciente) ON DELETE RESTRICT) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_as_ci;
ALTER TABLE responsable ADD COLUMN principal_paciente INTEGER
 GENERATED ALWAYS AS (CASE WHEN es_principal THEN id_paciente ELSE NULL END) STORED,
 ADD UNIQUE KEY uq_responsable_principal(principal_paciente);
-- At-least-one is enforced by atomic registration in every adapter; at-most-one by this index.
CREATE TABLE catalogo_cie10 (codigo_cie10 VARCHAR(10) PRIMARY KEY, descripcion VARCHAR(500) NOT NULL, capitulo VARCHAR(100)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_as_ci;
CREATE TABLE medicamento (
 id_medicamento INTEGER PRIMARY KEY, nombre_generico VARCHAR(120) NOT NULL,
 nombre_comercial VARCHAR(120), principio_activo VARCHAR(120) NOT NULL, concentracion VARCHAR(50) NOT NULL,
 forma_farmaceutica VARCHAR(50) NOT NULL, presentacion VARCHAR(100) NOT NULL,
 requiere_receta BOOLEAN NOT NULL, activo BOOLEAN NOT NULL DEFAULT TRUE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_as_ci;
CREATE TABLE consulta (
 id_consulta INTEGER AUTO_INCREMENT PRIMARY KEY,
 id_expediente INTEGER NOT NULL,
 id_profesional INTEGER NOT NULL,
 id_cita INTEGER, fecha_hora_inicio DATETIME(3) NOT NULL, fecha_hora_fin DATETIME(3) NOT NULL,
 tipo VARCHAR(20) NOT NULL, motivo_consulta VARCHAR(500) NOT NULL,
 enfermedad_actual TEXT, exploracion_fisica TEXT, plan TEXT, estado VARCHAR(12) NOT NULL,
 CHECK(id_cita IS NULL), CHECK(tipo IN ('primera_vez','seguimiento')), CHECK(estado='cerrada'),
 CHECK(fecha_hora_fin>=fecha_hora_inicio)
,
 FOREIGN KEY (id_expediente) REFERENCES expediente(id_expediente) ON DELETE RESTRICT,
 FOREIGN KEY (id_profesional) REFERENCES profesional(id_profesional) ON DELETE RESTRICT) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_as_ci;
-- CITA is deferred; id_cita must remain NULL. A future additive migration creates that table and FK.
CREATE INDEX ix_consulta_historial ON consulta(id_expediente,fecha_hora_inicio DESC,id_consulta DESC);
CREATE TABLE diagnostico (
 id_diagnostico INTEGER AUTO_INCREMENT PRIMARY KEY,
 id_consulta INTEGER NOT NULL,
 codigo_cie10 VARCHAR(10),
 descripcion VARCHAR(500) NOT NULL, tipo VARCHAR(15) NOT NULL, es_principal BOOLEAN NOT NULL,
 fecha_registro DATETIME(3) NOT NULL, CHECK(tipo IN ('presuntivo','definitivo'))
,
 FOREIGN KEY (id_consulta) REFERENCES consulta(id_consulta) ON DELETE RESTRICT,
 FOREIGN KEY (codigo_cie10) REFERENCES catalogo_cie10(codigo_cie10) ON DELETE RESTRICT) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_as_ci;
CREATE INDEX ix_diagnostico_consulta ON diagnostico(id_consulta,id_diagnostico);
ALTER TABLE diagnostico ADD COLUMN principal_consulta INTEGER
 GENERATED ALWAYS AS (CASE WHEN es_principal THEN id_consulta ELSE NULL END) STORED,
 ADD UNIQUE KEY uq_diagnostico_principal(principal_consulta);
CREATE TABLE tratamiento (
 id_tratamiento INTEGER AUTO_INCREMENT PRIMARY KEY,
 id_diagnostico INTEGER NOT NULL,
 tipo VARCHAR(25) NOT NULL, descripcion VARCHAR(1000) NOT NULL, indicaciones TEXT,
 fecha_inicio DATE NOT NULL, fecha_fin_estimada DATE, estado VARCHAR(12) NOT NULL,
 CHECK(tipo IN ('farmacologico','procedimiento','terapia','reposo','dieta')), CHECK(estado='activo'),
 CHECK(fecha_fin_estimada IS NULL OR fecha_fin_estimada>=fecha_inicio)
,
 FOREIGN KEY (id_diagnostico) REFERENCES diagnostico(id_diagnostico) ON DELETE RESTRICT) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_as_ci;
CREATE INDEX ix_tratamiento_diagnostico ON tratamiento(id_diagnostico,id_tratamiento);
CREATE TABLE receta (
 id_receta INTEGER AUTO_INCREMENT PRIMARY KEY,
 id_consulta INTEGER NOT NULL UNIQUE,
 id_profesional INTEGER NOT NULL,
 folio VARCHAR(40) NOT NULL UNIQUE, fecha_emision DATETIME(3) NOT NULL, observaciones TEXT,
 estado VARCHAR(12) NOT NULL CHECK(estado='emitida')
,
 FOREIGN KEY (id_consulta) REFERENCES consulta(id_consulta) ON DELETE RESTRICT,
 FOREIGN KEY (id_profesional) REFERENCES profesional(id_profesional) ON DELETE RESTRICT) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_as_ci;
CREATE TABLE detalle_receta (
 id_receta INTEGER NOT NULL,
 id_medicamento INTEGER NOT NULL,
 dosis VARCHAR(100) NOT NULL, via_administracion VARCHAR(50) NOT NULL,
 frecuencia_horas INTEGER NOT NULL CHECK(frecuencia_horas BETWEEN 1 AND 168),
 duracion_dias INTEGER NOT NULL CHECK(duracion_dias BETWEEN 1 AND 365),
 cantidad DECIMAL(8,2) NOT NULL CHECK(cantidad>0), indicaciones TEXT,
 PRIMARY KEY(id_receta,id_medicamento)
,
 FOREIGN KEY (id_receta) REFERENCES receta(id_receta) ON DELETE RESTRICT,
 FOREIGN KEY (id_medicamento) REFERENCES medicamento(id_medicamento) ON DELETE RESTRICT) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_as_ci;
CREATE TABLE id_counter (nombre VARCHAR(40) PRIMARY KEY, siguiente INTEGER NOT NULL CHECK(siguiente>0)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_as_ci;
INSERT INTO id_counter VALUES ('receta_folio',1);

-- Sección 7.5 excludes hospitalización: CAMA and NOTA_EVOLUCION remain in C4a only.
CREATE SQL SECURITY DEFINER VIEW reporte_pacientes AS SELECT id_institucion,estado,COUNT(*) AS cantidad FROM paciente GROUP BY id_institucion,estado;


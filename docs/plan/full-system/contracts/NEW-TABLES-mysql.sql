-- Full-system PLANNING DDL: mysql. Not run, not app code.
-- Additive new tables absent from baseline C4 only. Apply per module migration owner.
-- Native FKs/unique/check constraints are REQUIRED later in FS-RELATIONS/F3; this file alone is NOT a green migration/gate.
-- No DROP/reset. Actual existing table amendments are separately specified F3/schema-additions.

-- Owner FS-03-MY01; source entity CONTACTO_EMERGENCIA
CREATE TABLE contacto_emergencia (
 id_institucion INTEGER NOT NULL,
 id_contacto INTEGER AUTO_INCREMENT NOT NULL,
 id_paciente INTEGER NOT NULL,
 nombre_completo VARCHAR(120) NOT NULL,
 parentesco VARCHAR(30) NOT NULL,
 telefono VARCHAR(20) NOT NULL,
 telefono_alterno VARCHAR(20),
 es_principal BOOLEAN NOT NULL,
 UNIQUE (id_contacto),
 PRIMARY KEY (id_institucion, id_contacto)
) ENGINE=InnoDB;

-- Owner FS-04-MY01; source entity ANTECEDENTE
CREATE TABLE antecedente (
 id_institucion INTEGER NOT NULL,
 id_antecedente INTEGER AUTO_INCREMENT NOT NULL,
 id_expediente INTEGER NOT NULL,
 tipo VARCHAR(20) NOT NULL,
 descripcion VARCHAR(300) NOT NULL,
 fecha_inicio DATE,
 vigente BOOLEAN NOT NULL,
 fecha_registro DATETIME(3) NOT NULL,
 UNIQUE (id_antecedente),
 PRIMARY KEY (id_institucion, id_antecedente)
) ENGINE=InnoDB;

-- Owner FS-04-MY01; source entity ALERGIA
CREATE TABLE alergia (
 id_institucion INTEGER NOT NULL,
 id_alergia INTEGER AUTO_INCREMENT NOT NULL,
 id_expediente INTEGER NOT NULL,
 sustancia VARCHAR(120) NOT NULL,
 tipo VARCHAR(20) NOT NULL,
 severidad VARCHAR(15) NOT NULL,
 reaccion VARCHAR(200),
 fecha_deteccion DATE,
 UNIQUE (id_alergia),
 PRIMARY KEY (id_institucion, id_alergia)
) ENGINE=InnoDB;

-- Owner FS-05-MY01; source entity DOCUMENTO_ADJUNTO
CREATE TABLE documento_adjunto (
 id_institucion INTEGER NOT NULL,
 id_documento INTEGER AUTO_INCREMENT NOT NULL,
 id_expediente INTEGER NOT NULL,
 id_consulta INTEGER,
 nombre_archivo VARCHAR(160) NOT NULL,
 tipo_mime VARCHAR(60) NOT NULL,
 ruta VARCHAR(300) NOT NULL,
 hash_sha256 CHAR(64) NOT NULL,
 fecha_carga DATETIME(3) NOT NULL,
 UNIQUE (id_documento),
 PRIMARY KEY (id_institucion, id_documento)
) ENGINE=InnoDB;

-- Owner FS-06-MY01; source entity CITA
CREATE TABLE cita (
 id_institucion INTEGER NOT NULL,
 id_cita INTEGER AUTO_INCREMENT NOT NULL,
 id_paciente INTEGER NOT NULL,
 id_profesional INTEGER NOT NULL,
 id_especialidad INTEGER,
 fecha_hora DATETIME(3) NOT NULL,
 duracion_minutos SMALLINT NOT NULL,
 motivo VARCHAR(200),
 estado VARCHAR(20) NOT NULL,
 id_usuario_registra INTEGER NOT NULL,
 fecha_creacion DATETIME(3) NOT NULL,
 UNIQUE (id_cita),
 PRIMARY KEY (id_institucion, id_cita)
) ENGINE=InnoDB;

-- Owner FS-07-MY01; source entity SIGNOS_VITALES
CREATE TABLE signos_vitales (
 id_institucion INTEGER NOT NULL,
 id_signos INTEGER AUTO_INCREMENT NOT NULL,
 id_consulta INTEGER NOT NULL,
 fecha_hora_toma DATETIME(3) NOT NULL,
 presion_sistolica SMALLINT,
 presion_diastolica SMALLINT,
 frecuencia_cardiaca SMALLINT,
 frecuencia_respiratoria SMALLINT,
 temperatura_c DECIMAL(4,1),
 saturacion_oxigeno SMALLINT,
 peso_kg DECIMAL(5,2),
 talla_cm DECIMAL(5,1),
 UNIQUE (id_signos),
 PRIMARY KEY (id_institucion, id_signos)
) ENGINE=InnoDB;

-- Owner FS-07-MY01; source entity CONSULTA_BORRADOR
CREATE TABLE consulta_borrador (
 id_institucion INTEGER NOT NULL,
 id_consulta INTEGER NOT NULL,
 bundle JSON NOT NULL,
 revision INTEGER NOT NULL,
 PRIMARY KEY (id_institucion, id_consulta)
) ENGINE=InnoDB;

-- Owner FS-07-MY01; source entity ANULACION_CONSULTA
CREATE TABLE anulacion_consulta (
 id_institucion INTEGER NOT NULL,
 id_consulta INTEGER NOT NULL,
 motivo VARCHAR(300) NOT NULL,
 id_usuario INTEGER NOT NULL,
 fecha_hora DATETIME(3) NOT NULL,
 PRIMARY KEY (id_institucion, id_consulta)
) ENGINE=InnoDB;

-- Owner FS-12-MY01; source entity ANTECEDENTE_PERINATAL
CREATE TABLE antecedente_perinatal (
 id_institucion INTEGER NOT NULL,
 id_expediente INTEGER NOT NULL,
 semanas_gestacion SMALLINT,
 tipo_parto VARCHAR(20),
 peso_nacimiento_g SMALLINT,
 talla_nacimiento_cm DECIMAL(4,1),
 apgar_1min SMALLINT,
 apgar_5min SMALLINT,
 complicaciones VARCHAR(300),
 PRIMARY KEY (id_institucion, id_expediente)
) ENGINE=InnoDB;

-- Owner FS-12-MY01; source entity MEDICION_ANTROPOMETRICA
CREATE TABLE medicion_antropometrica (
 id_institucion INTEGER NOT NULL,
 id_medicion INTEGER AUTO_INCREMENT NOT NULL,
 id_consulta INTEGER NOT NULL,
 fecha_medicion DATE,
 edad_meses SMALLINT NOT NULL,
 peso_kg DECIMAL(5,2) NOT NULL,
 talla_cm DECIMAL(5,1) NOT NULL,
 perimetro_cefalico_cm DECIMAL(4,1),
 percentil_peso_edad DECIMAL(5,2),
 percentil_talla_edad DECIMAL(5,2),
 percentil_pc_edad DECIMAL(5,2),
 puntuacion_z_peso DECIMAL(4,2),
 puntuacion_z_talla DECIMAL(4,2),
 version_referencia VARCHAR(20) NOT NULL,
 UNIQUE (id_medicion),
 PRIMARY KEY (id_institucion, id_medicion)
) ENGINE=InnoDB;

-- Owner FS-12-MY01; source entity REFERENCIA_OMS
CREATE TABLE referencia_oms (
 id_institucion INTEGER NOT NULL,
 version VARCHAR(20) NOT NULL,
 indicador VARCHAR(30) NOT NULL,
 sexo CHAR(1) NOT NULL,
 edad_dias INTEGER NOT NULL,
 l DECIMAL(14,8) NOT NULL,
 m DECIMAL(14,8) NOT NULL,
 s DECIMAL(14,8) NOT NULL,
 PRIMARY KEY (id_institucion, version, indicador, sexo, edad_dias)
) ENGINE=InnoDB;

-- Owner FS-13-MY01; source entity VACUNA
CREATE TABLE vacuna (
 id_institucion INTEGER NOT NULL,
 id_vacuna INTEGER AUTO_INCREMENT NOT NULL,
 nombre VARCHAR(80) NOT NULL,
 enfermedad_previene VARCHAR(200) NOT NULL,
 dosis_totales SMALLINT NOT NULL,
 via_administracion VARCHAR(20) NOT NULL,
 edad_recomendada_meses SMALLINT NOT NULL,
 UNIQUE (id_vacuna),
 PRIMARY KEY (id_institucion, id_vacuna)
) ENGINE=InnoDB;

-- Owner FS-13-MY01; source entity DOSIS_VACUNA
CREATE TABLE dosis_vacuna (
 id_institucion INTEGER NOT NULL,
 id_dosis INTEGER AUTO_INCREMENT NOT NULL,
 id_expediente INTEGER NOT NULL,
 id_vacuna INTEGER NOT NULL,
 numero_dosis SMALLINT NOT NULL,
 fecha_programada DATE NOT NULL,
 fecha_aplicacion DATE,
 lote VARCHAR(30),
 fabricante VARCHAR(60),
 sitio_aplicacion VARCHAR(30),
 id_profesional INTEGER,
 estado VARCHAR(20) NOT NULL,
 reaccion_adversa VARCHAR(300),
 UNIQUE (id_dosis),
 PRIMARY KEY (id_institucion, id_dosis)
) ENGINE=InnoDB;

-- Owner FS-13-MY01; source entity VACUNA_INTERVALO
CREATE TABLE vacuna_intervalo (
 id_institucion INTEGER NOT NULL,
 id_vacuna INTEGER NOT NULL,
 numero_dosis INTEGER NOT NULL,
 edad_meses INTEGER NOT NULL,
 PRIMARY KEY (id_institucion, id_vacuna, numero_dosis)
) ENGINE=InnoDB;

-- Owner FS-14-MY01; source entity HITO_DESARROLLO
CREATE TABLE hito_desarrollo (
 id_institucion INTEGER NOT NULL,
 id_hito INTEGER AUTO_INCREMENT NOT NULL,
 nombre VARCHAR(120) NOT NULL,
 area VARCHAR(30) NOT NULL,
 edad_esperada_meses SMALLINT NOT NULL,
 UNIQUE (id_hito),
 PRIMARY KEY (id_institucion, id_hito)
) ENGINE=InnoDB;

-- Owner FS-14-MY01; source entity SEGUIMIENTO_HITO
CREATE TABLE seguimiento_hito (
 id_institucion INTEGER NOT NULL,
 id_expediente INTEGER NOT NULL,
 id_hito INTEGER NOT NULL,
 alcanzado BOOLEAN NOT NULL,
 fecha_evaluacion DATE NOT NULL,
 observacion VARCHAR(300),
 PRIMARY KEY (id_institucion, id_expediente, id_hito)
) ENGINE=InnoDB;

-- Owner FS-20-MY01; source entity PROFESIONAL_CONTRATO
CREATE TABLE profesional_contrato (
 id_institucion INTEGER NOT NULL,
 id_profesional INTEGER NOT NULL,
 id_tipo_personal INTEGER NOT NULL,
 modalidad_contrato VARCHAR(20) NOT NULL,
 fecha_ingreso DATE NOT NULL,
 PRIMARY KEY (id_institucion, id_profesional)
) ENGINE=InnoDB;

-- Owner FS-20-MY01; source entity TARIFA_HONORARIO
CREATE TABLE tarifa_honorario (
 id_institucion INTEGER NOT NULL,
 id_tarifa INTEGER AUTO_INCREMENT NOT NULL,
 id_profesional INTEGER NOT NULL,
 codigo_servicio VARCHAR(12) NOT NULL,
 modalidad VARCHAR(15) NOT NULL,
 monto_fijo DECIMAL(10,2),
 porcentaje DECIMAL(5,2),
 vigente_desde DATE NOT NULL,
 vigente_hasta DATE,
 UNIQUE (id_tarifa),
 PRIMARY KEY (id_institucion, id_tarifa)
) ENGINE=InnoDB;

-- Owner FS-21-MY01; source entity ROL_CLINICO
CREATE TABLE rol_clinico (
 id_institucion INTEGER NOT NULL,
 codigo_rol VARCHAR(15) NOT NULL,
 nombre VARCHAR(60) NOT NULL,
 factor_honorario DECIMAL(4,3) NOT NULL,
 descripcion VARCHAR(200),
 PRIMARY KEY (id_institucion, codigo_rol)
) ENGINE=InnoDB;

-- Owner FS-21-MY01; source entity PARTICIPACION
CREATE TABLE participacion (
 id_institucion INTEGER NOT NULL,
 id_participacion INTEGER AUTO_INCREMENT NOT NULL,
 id_profesional INTEGER NOT NULL,
 codigo_rol VARCHAR(15) NOT NULL,
 id_consulta INTEGER,
 id_procedimiento INTEGER,
 fecha_hora_inicio DATETIME(3) NOT NULL,
 fecha_hora_fin DATETIME(3),
 honorario_calculado DECIMAL(10,2),
 observacion VARCHAR(200),
 UNIQUE (id_participacion),
 PRIMARY KEY (id_institucion, id_participacion)
) ENGINE=InnoDB;

-- Owner FS-22-MY01; source entity INSUMO
CREATE TABLE insumo (
 id_insumo INTEGER AUTO_INCREMENT NOT NULL,
 id_institucion INTEGER NOT NULL,
 codigo VARCHAR(20) NOT NULL,
 nombre VARCHAR(120) NOT NULL,
 tipo VARCHAR(25) NOT NULL,
 id_medicamento INTEGER,
 unidad_medida VARCHAR(20) NOT NULL,
 precio_unitario DECIMAL(10,2) NOT NULL,
 codigo_servicio VARCHAR(12),
 requiere_lote BOOLEAN NOT NULL,
 controlado BOOLEAN NOT NULL,
 existencia_actual INTEGER,
 UNIQUE (id_insumo),
 PRIMARY KEY (id_institucion, id_insumo)
) ENGINE=InnoDB;

-- Owner FS-22-MY01; source entity CONSUMO_INSUMO
CREATE TABLE consumo_insumo (
 id_institucion INTEGER NOT NULL,
 id_consumo INTEGER AUTO_INCREMENT NOT NULL,
 id_insumo INTEGER NOT NULL,
 id_admision INTEGER,
 id_procedimiento INTEGER,
 id_consulta INTEGER,
 cantidad DECIMAL(8,2) NOT NULL,
 precio_unitario DECIMAL(10,2) NOT NULL,
 fecha_hora DATETIME(3) NOT NULL,
 lote VARCHAR(30),
 id_profesional_registra INTEGER NOT NULL,
 UNIQUE (id_consumo),
 PRIMARY KEY (id_institucion, id_consumo)
) ENGINE=InnoDB;

-- Owner FS-23-MY01; source entity SERVICIO_FACTURABLE
CREATE TABLE servicio_facturable (
 codigo_servicio VARCHAR(12) NOT NULL,
 id_institucion INTEGER NOT NULL,
 nombre VARCHAR(120) NOT NULL,
 tipo VARCHAR(25) NOT NULL,
 precio_unitario DECIMAL(10,2) NOT NULL,
 unidad VARCHAR(20) NOT NULL,
 afecto_iva BOOLEAN NOT NULL,
 vigente BOOLEAN NOT NULL,
 PRIMARY KEY (id_institucion, codigo_servicio)
) ENGINE=InnoDB;

-- Owner FS-23-MY01; source entity CARGO
CREATE TABLE cargo (
 id_institucion INTEGER NOT NULL,
 id_cargo INTEGER AUTO_INCREMENT NOT NULL,
 id_expediente INTEGER NOT NULL,
 codigo_servicio VARCHAR(12) NOT NULL,
 origen VARCHAR(20) NOT NULL,
 id_consulta INTEGER,
 id_procedimiento INTEGER,
 id_admision INTEGER,
 id_consumo INTEGER,
 id_participacion INTEGER,
 descripcion VARCHAR(150) NOT NULL,
 cantidad DECIMAL(8,2) NOT NULL,
 precio_unitario DECIMAL(10,2) NOT NULL,
 subtotal DECIMAL(10,2) NOT NULL,
 fecha_hora DATETIME(3) NOT NULL,
 estado VARCHAR(15) NOT NULL,
 UNIQUE (id_cargo),
 PRIMARY KEY (id_institucion, id_cargo)
) ENGINE=InnoDB;

-- Owner FS-23-MY01; source entity COMANDO_IDEMPOTENTE
CREATE TABLE comando_idempotente (
 id_institucion INTEGER NOT NULL,
 clave VARCHAR(80) NOT NULL,
 operacion VARCHAR(20) NOT NULL,
 hash_request CHAR(64) NOT NULL,
 respuesta JSON NOT NULL,
 PRIMARY KEY (id_institucion, clave)
) ENGINE=InnoDB;

-- Owner FS-24-MY01; source entity FACTURA
CREATE TABLE factura (
 id_factura INTEGER AUTO_INCREMENT NOT NULL,
 id_institucion INTEGER NOT NULL,
 id_paciente INTEGER NOT NULL,
 serie VARCHAR(10) NOT NULL,
 numero INTEGER NOT NULL,
 fecha_emision DATETIME(3) NOT NULL,
 nombre_receptor VARCHAR(150) NOT NULL,
 nit_receptor VARCHAR(15) NOT NULL,
 subtotal DECIMAL(10,2) NOT NULL,
 descuento DECIMAL(10,2) NOT NULL,
 impuesto DECIMAL(10,2) NOT NULL,
 total DECIMAL(10,2) NOT NULL,
 cobertura_seguro DECIMAL(10,2),
 saldo_pendiente DECIMAL(10,2) NOT NULL,
 estado VARCHAR(15) NOT NULL,
 motivo_anulacion VARCHAR(200),
 id_usuario_emite INTEGER NOT NULL,
 autorizacion_fel VARCHAR(60),
 UNIQUE (id_factura),
 PRIMARY KEY (id_institucion, id_factura)
) ENGINE=InnoDB;

-- Owner FS-24-MY01; source entity DETALLE_FACTURA
CREATE TABLE detalle_factura (
 id_institucion INTEGER NOT NULL,
 id_factura INTEGER NOT NULL,
 linea SMALLINT NOT NULL,
 codigo_servicio VARCHAR(12) NOT NULL,
 descripcion VARCHAR(150) NOT NULL,
 cantidad DECIMAL(8,2) NOT NULL,
 precio_unitario DECIMAL(10,2) NOT NULL,
 subtotal_linea DECIMAL(10,2) NOT NULL,
 id_cargo INTEGER NOT NULL,
 PRIMARY KEY (id_institucion, id_factura, linea)
) ENGINE=InnoDB;

-- Owner FS-24-MY01; source entity CORRELATIVO_FACTURA
CREATE TABLE correlativo_factura (
 id_institucion INTEGER NOT NULL,
 serie VARCHAR(10) NOT NULL,
 siguiente INTEGER NOT NULL,
 PRIMARY KEY (id_institucion, serie)
) ENGINE=InnoDB;

-- Owner FS-25-MY01; source entity PAGO
CREATE TABLE pago (
 id_institucion INTEGER NOT NULL,
 id_pago INTEGER AUTO_INCREMENT NOT NULL,
 id_factura INTEGER NOT NULL,
 fecha_hora DATETIME(3) NOT NULL,
 monto DECIMAL(10,2) NOT NULL,
 metodo VARCHAR(20) NOT NULL,
 referencia VARCHAR(60),
 id_usuario_recibe INTEGER NOT NULL,
 anulado BOOLEAN NOT NULL,
 UNIQUE (id_pago),
 PRIMARY KEY (id_institucion, id_pago)
) ENGINE=InnoDB;

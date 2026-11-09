-- Pediatrics specialty tables (MySQL only). Idempotent CREATE IF NOT EXISTS.

CREATE TABLE IF NOT EXISTS antecedente_perinatal (
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_as_ci;

CREATE TABLE IF NOT EXISTS medicion_antropometrica (
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_as_ci;

CREATE TABLE IF NOT EXISTS referencia_oms (
 id_institucion INTEGER NOT NULL,
 version VARCHAR(20) NOT NULL,
 indicador VARCHAR(30) NOT NULL,
 sexo CHAR(1) NOT NULL,
 edad_dias INTEGER NOT NULL,
 l DECIMAL(14,8) NOT NULL,
 m DECIMAL(14,8) NOT NULL,
 s DECIMAL(14,8) NOT NULL,
 PRIMARY KEY (id_institucion, version, indicador, sexo, edad_dias)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_as_ci;

CREATE TABLE IF NOT EXISTS vacuna (
 id_institucion INTEGER NOT NULL,
 id_vacuna INTEGER AUTO_INCREMENT NOT NULL,
 nombre VARCHAR(80) NOT NULL,
 enfermedad_previene VARCHAR(200) NOT NULL,
 dosis_totales SMALLINT NOT NULL,
 via_administracion VARCHAR(20) NOT NULL,
 edad_recomendada_meses SMALLINT NOT NULL,
 UNIQUE (id_vacuna),
 PRIMARY KEY (id_institucion, id_vacuna)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_as_ci;

CREATE TABLE IF NOT EXISTS dosis_vacuna (
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_as_ci;

CREATE TABLE IF NOT EXISTS vacuna_intervalo (
 id_institucion INTEGER NOT NULL,
 id_vacuna INTEGER NOT NULL,
 numero_dosis INTEGER NOT NULL,
 edad_meses INTEGER NOT NULL,
 PRIMARY KEY (id_institucion, id_vacuna, numero_dosis)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_as_ci;

CREATE TABLE IF NOT EXISTS hito_desarrollo (
 id_institucion INTEGER NOT NULL,
 id_hito INTEGER AUTO_INCREMENT NOT NULL,
 nombre VARCHAR(120) NOT NULL,
 area VARCHAR(30) NOT NULL,
 edad_esperada_meses SMALLINT NOT NULL,
 UNIQUE (id_hito),
 PRIMARY KEY (id_institucion, id_hito)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_as_ci;

CREATE TABLE IF NOT EXISTS seguimiento_hito (
 id_institucion INTEGER NOT NULL,
 id_expediente INTEGER NOT NULL,
 id_hito INTEGER NOT NULL,
 alcanzado BOOLEAN NOT NULL,
 fecha_evaluacion DATE NOT NULL,
 observacion VARCHAR(300),
 PRIMARY KEY (id_institucion, id_expediente, id_hito)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_as_ci;

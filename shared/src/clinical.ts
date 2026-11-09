/**
 * Wire/DTO shapes from Entrega I relational model (sección 7.4).
 * Attribute names match `rel-*.mmd`. Do not invent columns.
 */

import type {
  ConsultaId,
  DiagnosticoId,
  ExpedienteId,
  InstitutionId,
  PacienteId,
  ProfesionalId,
  RecetaId,
  TratamientoId,
} from './ids.js';

/** PACIENTE.estado — sección 5: activo, inactivo (not archivado). */
export type PacienteEstado = 'activo' | 'inactivo';

/** EXPEDIENTE.estado — sección 5: activo, archivado. Clinical rows are never deleted. */
export type ExpedienteEstado = 'activo' | 'archivado';

/** EXPEDIENTE.motivo_archivo — sección 5 restricted values. */
export type MotivoArchivo = 'traslado' | 'fallecimiento' | 'administrativo' | 'inactividad';

export type Sexo = 'M' | 'F' | 'X';

/** INSTITUCION from rel-acceso.mmd */
export interface InstitucionDto {
  id_institucion: InstitutionId;
  nombre: string;
  tipo: string;
  nit: string;
  direccion: string;
  telefono: string;
  correo: string;
  motor_datos: string;
  activo: boolean;
}

/** PACIENTE from rel-paciente-expediente.mmd */
export interface PacienteDto {
  id_paciente: PacienteId;
  id_institucion: InstitutionId;
  tipo_documento: string;
  numero_documento: string;
  primer_nombre: string;
  segundo_nombre: string | null;
  primer_apellido: string;
  segundo_apellido: string | null;
  fecha_nacimiento: string;
  sexo: Sexo;
  tipo_sangre: string | null;
  telefono: string | null;
  correo: string | null;
  direccion: string | null;
  id_municipio: number | null;
  fecha_registro: string;
  estado: PacienteEstado;
}

/** EXPEDIENTE from rel-paciente-expediente.mmd */
export interface ExpedienteDto {
  id_expediente: ExpedienteId;
  id_paciente: PacienteId;
  numero_expediente: string;
  fecha_apertura: string;
  estado: ExpedienteEstado;
  fecha_archivo: string | null;
  motivo_archivo: MotivoArchivo | null;
  observacion_archivo: string | null;
}

/** CONSULTA from rel-atencion.mmd */
export interface ConsultaDto {
  id_consulta: ConsultaId;
  id_expediente: ExpedienteId;
  id_profesional: ProfesionalId;
  id_cita: number | null;
  fecha_hora_inicio: string;
  fecha_hora_fin: string | null;
  tipo: string;
  motivo_consulta: string;
  enfermedad_actual: string | null;
  exploracion_fisica: string | null;
  plan: string | null;
  estado: string;
}

/** DIAGNOSTICO from rel-atencion.mmd */
export interface DiagnosticoDto {
  id_diagnostico: DiagnosticoId;
  id_consulta: ConsultaId;
  codigo_cie10: string | null;
  descripcion: string;
  tipo: string;
  es_principal: boolean;
  fecha_registro: string;
}

/** TRATAMIENTO from rel-atencion.mmd */
export interface TratamientoDto {
  id_tratamiento: TratamientoId;
  id_diagnostico: DiagnosticoId;
  tipo: string;
  descripcion: string;
  indicaciones: string | null;
  fecha_inicio: string;
  fecha_fin_estimada: string | null;
  estado: string;
}

/** RECETA from rel-atencion.mmd */
export interface RecetaDto {
  id_receta: RecetaId;
  id_consulta: ConsultaId;
  id_profesional: ProfesionalId;
  folio: string;
  fecha_emision: string;
  observaciones: string | null;
  estado: string;
}

/** DETALLE_RECETA — only M:N resolution named in the relational model. */
export interface DetalleRecetaDto {
  id_receta: RecetaId;
  id_medicamento: number;
  dosis: string;
  via_administracion: string;
  frecuencia_horas: number;
  duracion_dias: number;
  cantidad: number;
  indicaciones: string | null;
}

export interface ArchiveExpedienteInput {
  id_expediente: ExpedienteId;
  motivo_archivo: MotivoArchivo;
  observacion_archivo?: string;
  fecha_archivo: string;
}

/** Clear archive metadata; previous values must be audited by the caller. */
export interface ReactivateExpedienteInput {
  id_expediente: ExpedienteId;
}

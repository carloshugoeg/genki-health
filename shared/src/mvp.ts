import type {
  ConsultaDto,
  DetalleRecetaDto,
  DiagnosticoDto,
  ExpedienteDto,
  MotivoArchivo,
  PacienteDto,
  RecetaDto,
  TratamientoDto,
} from './clinical.js';

export interface ResponsableInput {
  tipo_documento: string;
  numero_documento: string;
  nombre_completo: string;
  parentesco: 'madre' | 'padre' | 'abuelo' | 'tutor_legal' | 'otro';
  telefono: string;
  correo?: string | null;
  direccion?: string | null;
  es_principal: boolean;
}

export interface RegisterPacienteRequest {
  tipo_documento: string;
  numero_documento: string;
  primer_nombre: string;
  segundo_nombre?: string | null;
  primer_apellido: string;
  segundo_apellido?: string | null;
  fecha_nacimiento: string;
  sexo: 'M' | 'F' | 'X';
  tipo_sangre?: string | null;
  telefono?: string | null;
  correo?: string | null;
  direccion?: string | null;
  id_municipio?: number | null;
  responsables?: ResponsableInput[];
}

export interface DiagnosticoInput {
  codigo_cie10?: string | null;
  descripcion: string;
  tipo: 'presuntivo' | 'definitivo';
  es_principal: boolean;
}

export interface TratamientoInput {
  diagnostico_index: number;
  tipo: 'farmacologico' | 'procedimiento' | 'terapia' | 'reposo' | 'dieta';
  descripcion: string;
  indicaciones?: string | null;
  fecha_inicio: string;
  fecha_fin_estimada?: string | null;
  estado: 'activo';
}

export type DetalleInput = Omit<DetalleRecetaDto, 'id_receta'>;

export interface CloseConsultaRequest {
  id_profesional: number;
  fecha_hora_inicio: string;
  tipo: 'primera_vez' | 'seguimiento';
  motivo_consulta: string;
  enfermedad_actual?: string | null;
  exploracion_fisica?: string | null;
  plan?: string | null;
  diagnosticos: DiagnosticoInput[];
  tratamientos: TratamientoInput[];
  receta?: { observaciones?: string | null; detalles: DetalleInput[] };
}

export interface ConsultaCompleta {
  consulta: ConsultaDto;
  diagnosticos: DiagnosticoDto[];
  tratamientos: TratamientoDto[];
  receta: RecetaDto | null;
  detalles: DetalleRecetaDto[];
}

export interface PacienteResumen {
  paciente: PacienteDto;
  expediente: ExpedienteDto;
}

export interface PacientePage {
  items: PacienteResumen[];
  page: number;
  page_size: number;
  total: number;
}

export interface HistorialDto extends PacienteResumen {
  consultas: ConsultaCompleta[];
}

export interface CatalogosDto {
  municipios: { id_municipio: number; nombre: string }[];
  profesionales: { id_profesional: number; nombres: string; apellidos: string }[];
  medicamentos: { id_medicamento: number; nombre_generico: string }[];
  /** CATALOGO_CIE10 rows valid for `diagnosticos[].codigo_cie10`, sorted by code. */
  cie10: { codigo_cie10: string; descripcion: string }[];
}

export interface ArchiveRequest {
  motivo_archivo: MotivoArchivo;
  observacion_archivo?: string;
}

export type ClinicalErrorCode =
  | 'invalid_body'
  | 'invalid_query'
  | 'missing_bearer'
  | 'invalid_credentials'
  | 'invalid_token'
  | 'password_policy'
  | 'forbidden'
  | 'not_found'
  | 'duplicate_document'
  | 'guardian_required'
  | 'invalid_guardians'
  | 'expediente_archived'
  | 'already_archived'
  | 'consulta_abierta'
  | 'invalid_bundle'
  | 'reference_not_found'
  | 'conflict'
  | 'store_unavailable'
  | 'misconfigured'
  | 'internal_error';

export interface ErrorDto {
  error: ClinicalErrorCode;
  message: string;
}

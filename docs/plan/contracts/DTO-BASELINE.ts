// Frozen existing #9 wire shape, relevant MVP subset. Specification only, not a new runtime module.
export type InstitutionKind = 'hospital_general'|'centro_pediatrico'|'laboratorio_clinico'|'clinica_odontologica';
export type DataEngine = 'postgres'|'mysql'|'mongodb'|'firebase';
export type InstitutionId = number & {readonly __brand:'InstitutionId'};
export type PacienteId = number & {readonly __brand:'PacienteId'};
export type ExpedienteId = number & {readonly __brand:'ExpedienteId'};
export type ConsultaId = number & {readonly __brand:'ConsultaId'};
export type DiagnosticoId = number & {readonly __brand:'DiagnosticoId'};
export type TratamientoId = number & {readonly __brand:'TratamientoId'};
export type RecetaId = number & {readonly __brand:'RecetaId'};
export type ProfesionalId = number & {readonly __brand:'ProfesionalId'};
export type UsuarioId = number & {readonly __brand:'UsuarioId'};
export type PacienteEstado='activo'|'inactivo';
export type ExpedienteEstado='activo'|'archivado';
export type MotivoArchivo='traslado'|'fallecimiento'|'administrativo'|'inactividad';
export type Sexo='M'|'F'|'X';
export interface PacienteDto {
 id_paciente:PacienteId; id_institucion:InstitutionId; tipo_documento:string;
 numero_documento:string; primer_nombre:string; segundo_nombre:string|null;
 primer_apellido:string; segundo_apellido:string|null; fecha_nacimiento:string;
 sexo:Sexo; tipo_sangre:string|null; telefono:string|null; correo:string|null;
 direccion:string|null; id_municipio:number|null; fecha_registro:string; estado:PacienteEstado;
}
export interface ExpedienteDto {
 id_expediente:ExpedienteId; id_paciente:PacienteId; numero_expediente:string;
 fecha_apertura:string; estado:ExpedienteEstado; fecha_archivo:string|null;
 motivo_archivo:MotivoArchivo|null; observacion_archivo:string|null;
}
export interface ConsultaDto {
 id_consulta:ConsultaId; id_expediente:ExpedienteId; id_profesional:ProfesionalId;
 id_cita:number|null; fecha_hora_inicio:string; fecha_hora_fin:string|null; tipo:string;
 motivo_consulta:string; enfermedad_actual:string|null; exploracion_fisica:string|null;
 plan:string|null; estado:string;
}
export interface DiagnosticoDto {
 id_diagnostico:DiagnosticoId; id_consulta:ConsultaId; codigo_cie10:string|null;
 descripcion:string; tipo:string; es_principal:boolean; fecha_registro:string;
}
export interface TratamientoDto {
 id_tratamiento:TratamientoId; id_diagnostico:DiagnosticoId; tipo:string; descripcion:string;
 indicaciones:string|null; fecha_inicio:string; fecha_fin_estimada:string|null; estado:string;
}
export interface RecetaDto {
 id_receta:RecetaId; id_consulta:ConsultaId; id_profesional:ProfesionalId; folio:string;
 fecha_emision:string; observaciones:string|null; estado:string;
}
export interface DetalleRecetaDto {
 id_receta:RecetaId; id_medicamento:number; dosis:string; via_administracion:string;
 frecuencia_horas:number; duracion_dias:number; cantidad:number; indicaciones:string|null;
}
export interface ArchiveExpedienteInput {
 id_expediente:ExpedienteId; motivo_archivo:MotivoArchivo; observacion_archivo?:string; fecha_archivo:string;
}
export interface AccessTokenClaims {
 sub:string; email:string; institucion_id:number; institucion_kind:InstitutionKind;
 roles:string[]; motor:DataEngine; iat:number; exp:number; typ:'access';
}
export interface RefreshTokenClaims {
 sub:string; institucion_id:number; institucion_kind:InstitutionKind; jti:string;
 iat:number; exp:number; typ:'refresh';
}
export interface AuthTokensDto {
 access_token:string; refresh_token:string; token_type:'Bearer'; expires_in:number;
}
export interface AuthPrincipalDto {
 id_usuario:UsuarioId; email:string; id_institucion:InstitutionId;
 institution_kind:InstitutionKind; roles:string[]; motor:DataEngine;
}
export interface LoginRequestDto {email:string; password:string; institution_kind:InstitutionKind}


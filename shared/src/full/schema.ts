/** Shared full-system schema aliases (F2). */

export type JsonValue =
  string | number | boolean | null | JsonValue[] | { readonly [key: string]: JsonValue };

export type PageQuery = { page?: number; page_size?: number };

export type Page<T> = {
  items: T[];
  page: number;
  page_size: number;
  total: number;
};

export interface ADMISION {
  id_admision: number;
  id_expediente: number;
  id_consulta_origen?: number | null;
  id_cama: number;
  tipo_ingreso: string;
  fecha_hora_ingreso: string;
  fecha_hora_egreso?: string | null;
  id_diagnostico_ingreso: number;
  id_diagnostico_egreso?: number | null;
  condicion_egreso?: string | null;
  estado: string;
}

export interface ALERGIA {
  id_alergia: number;
  id_expediente: number;
  sustancia: string;
  tipo: string;
  severidad: string;
  reaccion?: string | null;
  fecha_deteccion?: string | null;
}

export interface ANTECEDENTE {
  id_antecedente: number;
  id_expediente: number;
  tipo: string;
  descripcion: string;
  fecha_inicio?: string | null;
  vigente: boolean;
  fecha_registro: string;
}

export interface ANTECEDENTE_PERINATAL {
  id_expediente: number;
  semanas_gestacion?: number | null;
  tipo_parto?: string | null;
  peso_nacimiento_g?: number | null;
  talla_nacimiento_cm?: number | null;
  apgar_1min?: number | null;
  apgar_5min?: number | null;
  complicaciones?: string | null;
}

export interface ANULACION_CONSULTA {
  id_consulta: number;
  motivo: string;
  id_usuario: number;
  fecha_hora: string;
}

export interface BITACORA {
  id_bitacora: string;
  id_usuario: number;
  entidad: string;
  id_registro: string;
  accion: string;
  fecha_hora: string;
  direccion_ip?: string | null;
  detalle?: JsonValue | null;
}

export interface CAMA {
  id_cama: number;
  id_servicio: number;
  codigo: string;
  tipo_cama: string;
  codigo_servicio: string;
  estado: string;
}

export interface CARGO {
  id_cargo: number;
  id_expediente: number;
  codigo_servicio: string;
  origen: string;
  id_consulta?: number | null;
  id_procedimiento?: number | null;
  id_admision?: number | null;
  id_consumo?: number | null;
  id_participacion?: number | null;
  descripcion: string;
  cantidad: number;
  precio_unitario: string;
  subtotal: string;
  fecha_hora: string;
  estado: string;
}

export interface CATALOGO_PROCEDIMIENTO {
  codigo_procedimiento: string;
  nombre: string;
  categoria: string;
  duracion_estimada_min?: number | null;
}

export interface CITA {
  id_cita: number;
  id_paciente: number;
  id_profesional: number;
  id_especialidad?: number | null;
  fecha_hora: string;
  duracion_minutos: number;
  motivo?: string | null;
  estado: string;
  id_usuario_registra: number;
  fecha_creacion: string;
}

export interface COMANDO_IDEMPOTENTE {
  id_institucion: number;
  clave: string;
  operacion: string;
  hash_request: string;
  respuesta: JsonValue;
}

export interface CONSULTA {
  id_consulta: number;
  id_expediente: number;
  id_profesional: number;
  id_cita?: number | null;
  fecha_hora_inicio: string;
  fecha_hora_fin?: string | null;
  tipo: string;
  motivo_consulta: string;
  enfermedad_actual?: string | null;
  exploracion_fisica?: string | null;
  plan?: string | null;
  estado: string;
}

export interface CONSULTA_BORRADOR {
  id_consulta: number;
  bundle: JsonValue;
  revision: number;
}

export interface CONSUMO_INSUMO {
  id_consumo: number;
  id_insumo: number;
  id_admision?: number | null;
  id_procedimiento?: number | null;
  id_consulta?: number | null;
  cantidad: number;
  precio_unitario: string;
  fecha_hora: string;
  lote?: string | null;
  id_profesional_registra: number;
}

export interface CONTACTO_EMERGENCIA {
  id_contacto: number;
  id_paciente: number;
  nombre_completo: string;
  parentesco: string;
  telefono: string;
  telefono_alterno?: string | null;
  es_principal: boolean;
}

export interface CORRELATIVO_FACTURA {
  id_institucion: number;
  serie: string;
  siguiente: number;
}

export interface DETALLE_FACTURA {
  id_factura: number;
  linea: number;
  codigo_servicio: string;
  descripcion: string;
  cantidad: number;
  precio_unitario: string;
  subtotal_linea: string;
  id_cargo: number;
}

export interface DETALLE_RECETA {
  id_receta: number;
  id_medicamento: number;
  dosis: string;
  via_administracion: string;
  frecuencia_horas: number;
  duracion_dias: number;
  cantidad: number;
  indicaciones?: string | null;
}

export interface DIAGNOSTICO {
  id_diagnostico: number;
  id_consulta: number;
  codigo_cie10: string;
  descripcion: string;
  tipo: string;
  es_principal: boolean;
  fecha_registro: string;
  capitulo?: string | null;
}

export interface DOCUMENTO_ADJUNTO {
  id_documento: number;
  id_expediente: number;
  id_consulta?: number | null;
  nombre_archivo: string;
  tipo_mime: string;
  ruta: string;
  hash_sha256: string;
  fecha_carga: string;
}

export interface DOSIS_VACUNA {
  id_dosis: number;
  id_expediente: number;
  id_vacuna: number;
  numero_dosis: number;
  fecha_programada: string;
  fecha_aplicacion?: string | null;
  lote?: string | null;
  fabricante?: string | null;
  sitio_aplicacion?: string | null;
  id_profesional?: number | null;
  estado: string;
  reaccion_adversa?: string | null;
}

export interface ESPECIALIDAD {
  id_especialidad: number;
  nombre: string;
  descripcion?: string | null;
}

export interface EXAMEN {
  codigo_examen: string;
  nombre: string;
  tipo: string;
  area: string;
  metodo: string;
  tiempo_entrega_horas: number;
  requiere_ayuno: boolean;
}

export interface EXPEDIENTE {
  id_expediente: number;
  id_paciente: number;
  numero_expediente: string;
  fecha_apertura: string;
  estado: string;
  fecha_archivo?: string | null;
  motivo_archivo?: string | null;
  observacion_archivo?: string | null;
}

export interface FACTURA {
  id_factura: number;
  id_institucion: number;
  id_paciente: number;
  serie: string;
  numero: number;
  fecha_emision: string;
  nombre_receptor: string;
  nit_receptor: string;
  subtotal: string;
  descuento: string;
  impuesto: string;
  total: string;
  cobertura_seguro?: string | null;
  saldo_pendiente: string;
  estado: string;
  motivo_anulacion?: string | null;
  id_usuario_emite: number;
  autorizacion_fel?: string | null;
}

export interface HITO_DESARROLLO {
  id_hito: number;
  nombre: string;
  area: string;
  edad_esperada_meses: number;
}

export interface INSTITUCION {
  id_institucion: number;
  nombre: string;
  tipo: string;
  nit: string;
  direccion: string;
  telefono: string;
  correo?: string | null;
  motor_datos: string;
  activo: boolean;
}

export interface INSUMO {
  id_insumo: number;
  id_institucion: number;
  codigo: string;
  nombre: string;
  tipo: string;
  id_medicamento?: number | null;
  unidad_medida: string;
  precio_unitario: string;
  codigo_servicio?: string | null;
  requiere_lote: boolean;
  controlado: boolean;
  existencia_actual?: number | null;
}

export interface MEDICAMENTO {
  id_medicamento: number;
  nombre_generico: string;
  nombre_comercial?: string | null;
  principio_activo: string;
  concentracion: string;
  forma_farmaceutica: string;
  presentacion?: string | null;
  requiere_receta: boolean;
  activo: boolean;
}

export interface MEDICION_ANTROPOMETRICA {
  id_medicion: number;
  id_consulta: number;
  fecha_medicion?: string | null;
  edad_meses: number;
  peso_kg: number;
  talla_cm: number;
  perimetro_cefalico_cm?: number | null;
  percentil_peso_edad?: number | null;
  percentil_talla_edad?: number | null;
  percentil_pc_edad?: number | null;
  puntuacion_z_peso?: number | null;
  puntuacion_z_talla?: number | null;
  version_referencia: string;
}

export interface MUESTRA {
  id_muestra: number;
  id_orden: number;
  codigo_barras: string;
  tipo_muestra: string;
  fecha_hora_toma: string;
  condicion: string;
  responsable_toma: number;
}

export interface MUNICIPIO {
  id_municipio: number;
  nombre: string;
}

export interface NOTA_EVOLUCION {
  id_nota: number;
  id_admision: number;
  id_profesional: number;
  fecha_hora: string;
  contenido: string;
  turno?: string | null;
  id_nota_anterior?: number | null;
}

export interface ODONTOGRAMA {
  id_odontograma: number;
  id_expediente: number;
  fecha: string;
  notacion: string;
  id_profesional: number;
  observacion_general?: string | null;
}

export interface ORDEN_ESTUDIO {
  id_orden: number;
  id_consulta: number;
  id_institucion_destino: number;
  tipo_examen: string;
  prioridad: string;
  indicaciones?: string | null;
  fecha_solicitud: string;
  estado: string;
  referencia_externa?: string | null;
}

export interface ORDEN_EXAMEN {
  id_orden: number;
  id_paciente: number;
  institucion_origen: number;
  medico_solicitante: string;
  fecha_solicitud: string;
  prioridad: string;
  estado: string;
  observaciones?: string | null;
  referencia_externa?: string | null;
}

export interface ORDEN_EXAMEN_ITEM {
  id_orden: number;
  codigo_examen: string;
}

export interface OUTBOX_LAB {
  id_evento: string;
  tipo: string;
  origen_id: number;
  destino_id: number;
  payload: JsonValue;
  estado: string;
  intentos: number;
  fecha_hora: string;
}

export interface PACIENTE {
  id_paciente: number;
  id_institucion: number;
  tipo_documento: string;
  numero_documento?: string | null;
  primer_nombre: string;
  segundo_nombre?: string | null;
  primer_apellido: string;
  segundo_apellido?: string | null;
  fecha_nacimiento?: string | null;
  sexo: string;
  tipo_sangre?: string | null;
  telefono?: string | null;
  correo?: string | null;
  direccion?: string | null;
  id_municipio?: number | null;
  fecha_registro: string;
  estado: string;
}

export interface PAGO {
  id_pago: number;
  id_factura: number;
  fecha_hora: string;
  monto: string;
  metodo: string;
  referencia?: string | null;
  id_usuario_recibe: number;
  anulado: boolean;
}

export interface PARTICIPACION {
  id_participacion: number;
  id_profesional: number;
  codigo_rol: string;
  id_consulta?: number | null;
  id_procedimiento?: number | null;
  fecha_hora_inicio: string;
  fecha_hora_fin?: string | null;
  honorario_calculado?: string | null;
  observacion?: string | null;
}

export interface PERMISO {
  id_permiso: number;
  codigo: string;
  descripcion: string;
  nivel_dato: string;
}

export interface PIEZA_DENTAL {
  id_odontograma: number;
  numero_pieza: number;
  estado: string;
  superficies: JsonValue;
  movilidad: number;
  observacion?: string | null;
}

export interface PLAN_TRATAMIENTO {
  id_plan: number;
  id_expediente: number;
  fecha_elaboracion: string;
  id_profesional: number;
  estado: string;
  total_estimado: string;
  detalle: JsonValue;
}

export interface PROCEDIMIENTO {
  id_procedimiento: number;
  id_admision?: number | null;
  id_consulta?: number | null;
  codigo_procedimiento: string;
  id_profesional: number;
  fecha_hora: string;
  sala?: string | null;
  hallazgos?: string | null;
  complicaciones?: string | null;
}

export interface PROCEDIMIENTO_DENTAL {
  codigo: string;
  nombre: string;
  categoria: string;
  duracion_estimada_min: number;
  costo_referencia: string;
}

export interface PROFESIONAL {
  id_profesional: number;
  id_institucion: number;
  numero_colegiado?: string | null;
  nombres: string;
  apellidos: string;
  id_especialidad?: number | null;
  telefono?: string | null;
  correo?: string | null;
  activo: boolean;
}

export interface PROFESIONAL_CONTRATO {
  id_profesional: number;
  id_tipo_personal: number;
  modalidad_contrato: string;
  fecha_ingreso: string;
}

export interface RECETA {
  id_receta: number;
  id_consulta: number;
  folio: string;
  fecha_emision: string;
  id_profesional: number;
  observaciones?: string | null;
  estado: string;
}

export interface REFERENCIA_OMS {
  version: string;
  indicador: string;
  sexo: string;
  edad_dias: number;
  l: number;
  m: number;
  s: number;
}

export interface RESPONSABLE {
  id_responsable: number;
  id_paciente: number;
  tipo_documento: string;
  numero_documento: string;
  nombre_completo: string;
  parentesco: string;
  telefono: string;
  correo?: string | null;
  direccion?: string | null;
  es_principal: boolean;
}

export interface RESULTADO {
  id_resultado: number;
  id_orden: number;
  codigo_examen: string;
  id_muestra: number;
  fecha_hora_resultado: string;
  datos: JsonValue;
  estado: string;
  validado_por?: number | null;
  fecha_validacion?: string | null;
  observaciones?: string | null;
}

export interface ROL {
  id_rol: number;
  nombre: string;
  descripcion?: string | null;
}

export interface ROL_CLINICO {
  codigo_rol: string;
  nombre: string;
  factor_honorario: string;
  descripcion?: string | null;
}

export interface ROL_PERMISO {
  id_rol: number;
  id_permiso: number;
}

export interface SEGUIMIENTO_HITO {
  id_expediente: number;
  id_hito: number;
  alcanzado: boolean;
  fecha_evaluacion: string;
  observacion?: string | null;
}

export interface SERVICIO {
  id_servicio: number;
  nombre: string;
  piso?: string | null;
  activo: boolean;
}

export interface SERVICIO_FACTURABLE {
  codigo_servicio: string;
  id_institucion: number;
  nombre: string;
  tipo: string;
  precio_unitario: string;
  unidad: string;
  afecto_iva: boolean;
  vigente: boolean;
}

export interface SESION_TRATAMIENTO {
  id_sesion: number;
  id_plan: number;
  id_cita?: number | null;
  fecha: string;
  procedimientos_realizados: JsonValue;
  anestesia_utilizada?: string | null;
  observaciones?: string | null;
  saldo_pendiente: string;
}

export interface SIGNOS_VITALES {
  id_signos: number;
  id_consulta: number;
  fecha_hora_toma: string;
  presion_sistolica?: number | null;
  presion_diastolica?: number | null;
  frecuencia_cardiaca?: number | null;
  frecuencia_respiratoria?: number | null;
  temperatura_c?: number | null;
  saturacion_oxigeno?: number | null;
  peso_kg?: number | null;
  talla_cm?: number | null;
}

export interface TARIFA_HONORARIO {
  id_tarifa: number;
  id_profesional: number;
  codigo_servicio: string;
  modalidad: string;
  monto_fijo?: string | null;
  porcentaje?: string | null;
  vigente_desde: string;
  vigente_hasta?: string | null;
}

export interface TIPO_PERSONAL {
  id_tipo_personal: number;
  nombre: string;
  requiere_colegiado: boolean;
  genera_honorario: boolean;
}

export interface TRATAMIENTO {
  id_tratamiento: number;
  id_diagnostico: number;
  tipo: string;
  descripcion: string;
  indicaciones?: string | null;
  fecha_inicio: string;
  fecha_fin_estimada?: string | null;
  estado: string;
}

export interface USUARIO {
  id_usuario: number;
  id_institucion: number;
  id_profesional?: number | null;
  nombre_usuario: string;
  correo: string;
  hash_contrasena: string;
  id_rol: number;
  estado: string;
  intentos_fallidos: number;
  ultimo_acceso?: string | null;
}

export interface VACUNA {
  id_vacuna: number;
  nombre: string;
  enfermedad_previene: string;
  dosis_totales: number;
  via_administracion: string;
  edad_recomendada_meses: number;
}

export interface VACUNA_INTERVALO {
  id_vacuna: number;
  numero_dosis: number;
  edad_meses: number;
}

export interface VALOR_REFERENCIA {
  codigo_examen: string;
  analito: string;
  sexo: string;
  edad_min_meses: number;
  edad_max_meses: number;
  valor_min: number;
  valor_max: number;
  unidad: string;
}

export type CONTACTO_EMERGENCIAInput = {
  nombre_completo: string;
  parentesco: string;
  telefono: string;
  telefono_alterno?: string | null;
  es_principal: boolean;
};

export type ANTECEDENTEInput = {
  tipo: string;
  descripcion: string;
  fecha_inicio?: string | null;
  vigente: boolean;
};

export type ALERGIAInput = {
  sustancia: string;
  tipo: string;
  severidad: string;
  reaccion?: string | null;
  fecha_deteccion?: string | null;
};

export type CITAInput = {
  id_paciente: number;
  id_profesional: number;
  id_especialidad?: number | null;
  fecha_hora: string;
  duracion_minutos: number;
  motivo?: string | null;
};

export type SIGNOS_VITALESInput = {
  presion_sistolica?: number | null;
  presion_diastolica?: number | null;
  frecuencia_cardiaca?: number | null;
  frecuencia_respiratoria?: number | null;
  temperatura_c?: number | null;
  saturacion_oxigeno?: number | null;
  peso_kg?: number | null;
  talla_cm?: number | null;
};

export type ADMISIONInput = {
  id_consulta_origen?: number | null;
  id_cama: number;
  id_diagnostico_ingreso: number;
  tipo_ingreso: string;
  fecha_hora_ingreso: string;
};

export type NOTA_EVOLUCIONInput = {
  id_nota_anterior?: number | null;
  contenido: string;
  turno?: string | null;
};

export type ORDEN_ESTUDIOInput = {
  id_institucion_destino: number;
  tipo_examen: string;
  prioridad: string;
  indicaciones?: string | null;
};

export type ANTECEDENTE_PERINATALInput = {
  semanas_gestacion?: number | null;
  tipo_parto?: string | null;
  peso_nacimiento_g?: number | null;
  talla_nacimiento_cm?: number | null;
  apgar_1min?: number | null;
  apgar_5min?: number | null;
  complicaciones?: string | null;
};

export type CONSUMO_INSUMOInput = {
  id_insumo: number;
  id_admision?: number | null;
  id_procedimiento?: number | null;
  id_consulta?: number | null;
  id_profesional_registra: number;
  cantidad: number;
  lote?: string | null;
};

export type PARTICIPACIONInput = {
  id_profesional: number;
  codigo_rol: string;
  id_consulta?: number | null;
  id_procedimiento?: number | null;
  fecha_hora_inicio: string;
  fecha_hora_fin?: string | null;
  observacion?: string | null;
};

export type TARIFA_HONORARIOInput = {
  codigo_servicio: string;
  modalidad: string;
  monto_fijo?: string | null;
  porcentaje?: string | null;
  vigente_desde: string;
};

export type SEGUIMIENTO_HITOInput = {
  alcanzado: boolean;
  fecha_evaluacion: string;
  observacion?: string | null;
};

export type MUESTRAInput = {
  codigo_barras: string;
  tipo_muestra: string;
  fecha_hora_toma: string;
  condicion: string;
  responsable_toma: number;
};

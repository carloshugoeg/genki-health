import { z } from 'zod';

const text = (n: number) => z.string().trim().min(1).max(n);
const nullable = (n: number) => text(n).nullable().optional();
const id = z.number().int().positive().max(2147483647);
const date = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((s) => {
    const d = new Date(s + 'T00:00:00.000Z');
    return !Number.isNaN(d.valueOf()) && d.toISOString().slice(0, 10) === s;
  });
/** A birth date cannot be later than today (UTC calendar day; GT is UTC-6, so never ahead). */
const birthDate = date.refine((s) => s <= new Date().toISOString().slice(0, 10), {
  message: 'fecha_nacimiento no puede ser futura',
});
const iso = z.string().datetime({ offset: false });
const doc = text(25).transform((s) => s.toUpperCase());
const email = z.string().trim().email().max(120);

function atMostTwoDecimals(n: number): boolean {
  return Math.abs(Math.round(n * 100) - n * 100) < 1e-8;
}

export const kind = z.enum([
  'hospital_general',
  'centro_pediatrico',
  'laboratorio_clinico',
  'clinica_odontologica',
]);

export const loginSchema = z
  .object({
    email,
    password: z.string().min(1).max(200),
    institution_kind: kind,
  })
  .strict();

export const refreshSchema = z.object({ refresh_token: text(4096) }).strict();

export const responsableSchema = z
  .object({
    tipo_documento: text(20),
    numero_documento: doc,
    nombre_completo: text(150),
    parentesco: z.enum(['madre', 'padre', 'abuelo', 'tutor_legal', 'otro']),
    telefono: text(25),
    correo: email.nullable().optional(),
    direccion: nullable(250),
    es_principal: z.boolean(),
  })
  .strict();

export const registerSchema = z
  .object({
    tipo_documento: text(20),
    numero_documento: doc,
    primer_nombre: text(60),
    segundo_nombre: nullable(60),
    primer_apellido: text(60),
    segundo_apellido: nullable(60),
    fecha_nacimiento: birthDate,
    sexo: z.enum(['M', 'F', 'X']),
    tipo_sangre: nullable(5),
    telefono: nullable(25),
    correo: email.nullable().optional(),
    direccion: nullable(250),
    id_municipio: id.nullable().optional(),
    responsables: z.array(responsableSchema).max(5).optional(),
  })
  .strict();

export const archiveSchema = z
  .object({
    motivo_archivo: z.enum(['traslado', 'fallecimiento', 'administrativo', 'inactividad']),
    observacion_archivo: text(500).optional(),
  })
  .strict();

export const diagnosticoSchema = z
  .object({
    codigo_cie10: nullable(10),
    descripcion: text(500),
    tipo: z.enum(['presuntivo', 'definitivo']),
    es_principal: z.boolean(),
  })
  .strict();

export const tratamientoSchema = z
  .object({
    diagnostico_index: z.number().int().min(0),
    tipo: z.enum(['farmacologico', 'procedimiento', 'terapia', 'reposo', 'dieta']),
    descripcion: text(1000),
    indicaciones: nullable(1000),
    fecha_inicio: date,
    fecha_fin_estimada: date.nullable().optional(),
    estado: z.literal('activo'),
  })
  .strict();

export const detalleSchema = z
  .object({
    id_medicamento: id,
    dosis: text(100),
    via_administracion: text(50),
    frecuencia_horas: z.number().int().min(1).max(168),
    duracion_dias: z.number().int().min(1).max(365),
    cantidad: z
      .number()
      .positive()
      .max(999999.99)
      .refine(atMostTwoDecimals, { message: 'cantidad allows at most two decimal places' }),
    indicaciones: nullable(1000),
  })
  .strict();

export const closeSchema = z
  .object({
    id_profesional: id,
    fecha_hora_inicio: iso,
    tipo: z.enum(['primera_vez', 'seguimiento']),
    motivo_consulta: text(500),
    enfermedad_actual: nullable(2000),
    exploracion_fisica: nullable(2000),
    plan: nullable(2000),
    diagnosticos: z.array(diagnosticoSchema).min(1).max(10),
    tratamientos: z.array(tratamientoSchema).min(1).max(20),
    receta: z
      .object({
        observaciones: nullable(1000),
        detalles: z.array(detalleSchema).min(1).max(20),
      })
      .strict()
      .optional(),
  })
  .strict();

export const searchSchema = z
  .object({
    q: z.string().trim().max(100).default(''),
    estado: z.enum(['activo', 'archivado', 'todos']).default('activo'),
    page: z.coerce.number().int().min(1).max(10000).default(1),
    page_size: z.coerce.number().int().min(1).max(50).default(20),
  })
  .strict();

export const paramsSchema = z
  .object({
    id: z.coerce.number().int().positive().max(2147483647),
  })
  .strict();

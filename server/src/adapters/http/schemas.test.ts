import { describe, expect, it } from 'vitest';
import type {
  ArchiveRequest,
  ClinicalErrorCode,
  CloseConsultaRequest,
  DiagnosticoInput,
  RegisterPacienteRequest,
  ResponsableInput,
  TratamientoInput,
} from '@genki/shared';
import { ClinicalError } from '../../domain/clinical-error.js';
import {
  archiveSchema,
  closeSchema,
  detalleSchema,
  diagnosticoSchema,
  loginSchema,
  registerSchema,
  responsableSchema,
  tratamientoSchema,
} from './schemas.js';

/** Wire union from C2.1 / C2.4 — must stay identical to shared ClinicalErrorCode. */
const WIRE_CLINICAL_ERROR_CODES = [
  'invalid_body',
  'invalid_query',
  'missing_bearer',
  'invalid_credentials',
  'invalid_token',
  'password_policy',
  'forbidden',
  'not_found',
  'duplicate_document',
  'guardian_required',
  'invalid_guardians',
  'expediente_archived',
  'already_archived',
  'invalid_bundle',
  'reference_not_found',
  'conflict',
  'store_unavailable',
  'misconfigured',
  'internal_error',
] as const satisfies readonly ClinicalErrorCode[];

type AssertEqual<A, B> = (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2
  ? true
  : false;

const validRegister: RegisterPacienteRequest = {
  tipo_documento: 'DPI',
  numero_documento: '1234567890101',
  primer_nombre: 'Ana',
  primer_apellido: 'López',
  fecha_nacimiento: '1990-01-01',
  sexo: 'F',
};

describe('E2-P2-01 HTTP schemas and clinical errors', () => {
  it('schemas_reject_unknown_institution', () => {
    const ok = loginSchema.safeParse({
      email: 'hospital@genki.local',
      password: 'GenkiDev1',
      institution_kind: 'hospital_general',
    });
    expect(ok.success).toBe(true);

    const unknownKind = loginSchema.safeParse({
      email: 'hospital@genki.local',
      password: 'GenkiDev1',
      institution_kind: 'clinica_inventada',
    });
    expect(unknownKind.success).toBe(false);

    const unknownKey = loginSchema.safeParse({
      email: 'hospital@genki.local',
      password: 'GenkiDev1',
      institution_kind: 'hospital_general',
      motor: 'postgres',
    });
    expect(unknownKey.success).toBe(false);
  });

  it('schemas_reject_impossible_date', () => {
    const ok = registerSchema.safeParse(validRegister);
    expect(ok.success).toBe(true);

    const impossible = registerSchema.safeParse({
      ...validRegister,
      fecha_nacimiento: '2024-02-30',
    });
    expect(impossible.success).toBe(false);

    const badMonth = registerSchema.safeParse({
      ...validRegister,
      fecha_nacimiento: '2024-13-01',
    });
    expect(badMonth.success).toBe(false);

    const leapOk = registerSchema.safeParse({
      ...validRegister,
      fecha_nacimiento: '2024-02-29',
    });
    expect(leapOk.success).toBe(true);

    const leapBad = registerSchema.safeParse({
      ...validRegister,
      fecha_nacimiento: '2023-02-29',
    });
    expect(leapBad.success).toBe(false);

    const cantidadOk = detalleSchema.safeParse({
      id_medicamento: 1,
      dosis: '500mg',
      via_administracion: 'oral',
      frecuencia_horas: 8,
      duracion_dias: 7,
      cantidad: 1.25,
    });
    expect(cantidadOk.success).toBe(true);

    const cantidadBoundary = detalleSchema.safeParse({
      id_medicamento: 1,
      dosis: '500mg',
      via_administracion: 'oral',
      frecuencia_horas: 8,
      duracion_dias: 7,
      cantidad: 999999.99,
    });
    expect(cantidadBoundary.success).toBe(true);

    const cantidadTooPrecise = detalleSchema.safeParse({
      id_medicamento: 1,
      dosis: '500mg',
      via_administracion: 'oral',
      frecuencia_horas: 8,
      duracion_dias: 7,
      cantidad: 1.251,
    });
    expect(cantidadTooPrecise.success).toBe(false);

    const cantidadOverMax = detalleSchema.safeParse({
      id_medicamento: 1,
      dosis: '500mg',
      via_administracion: 'oral',
      frecuencia_horas: 8,
      duracion_dias: 7,
      cantidad: 1000000,
    });
    expect(cantidadOverMax.success).toBe(false);
  });

  it('schemas_match_dto_keys', () => {
    expect(Object.keys(registerSchema.shape).sort()).toEqual(
      (
        [
          'tipo_documento',
          'numero_documento',
          'primer_nombre',
          'segundo_nombre',
          'primer_apellido',
          'segundo_apellido',
          'fecha_nacimiento',
          'sexo',
          'tipo_sangre',
          'telefono',
          'correo',
          'direccion',
          'id_municipio',
          'responsables',
        ] satisfies (keyof RegisterPacienteRequest)[]
      ).sort(),
    );

    expect(Object.keys(responsableSchema.shape).sort()).toEqual(
      (
        [
          'tipo_documento',
          'numero_documento',
          'nombre_completo',
          'parentesco',
          'telefono',
          'correo',
          'direccion',
          'es_principal',
        ] satisfies (keyof ResponsableInput)[]
      ).sort(),
    );

    expect(Object.keys(archiveSchema.shape).sort()).toEqual(
      (['motivo_archivo', 'observacion_archivo'] satisfies (keyof ArchiveRequest)[]).sort(),
    );

    expect(Object.keys(diagnosticoSchema.shape).sort()).toEqual(
      (
        ['codigo_cie10', 'descripcion', 'tipo', 'es_principal'] satisfies (keyof DiagnosticoInput)[]
      ).sort(),
    );

    expect(Object.keys(tratamientoSchema.shape).sort()).toEqual(
      (
        [
          'diagnostico_index',
          'tipo',
          'descripcion',
          'indicaciones',
          'fecha_inicio',
          'fecha_fin_estimada',
          'estado',
        ] satisfies (keyof TratamientoInput)[]
      ).sort(),
    );

    expect(Object.keys(closeSchema.shape).sort()).toEqual(
      (
        [
          'id_profesional',
          'fecha_hora_inicio',
          'tipo',
          'motivo_consulta',
          'enfermedad_actual',
          'exploracion_fisica',
          'plan',
          'diagnosticos',
          'tratamientos',
          'receta',
        ] satisfies (keyof CloseConsultaRequest)[]
      ).sort(),
    );

    const parsed = registerSchema.parse({
      ...validRegister,
      numero_documento: 'dpi-abc',
    });
    expect(parsed.numero_documento).toBe('DPI-ABC');
  });

  it('clinical_error_codes_match_wire_union', () => {
    const domainCodes = ClinicalError.CODES;
    expect([...domainCodes].sort()).toEqual([...WIRE_CLINICAL_ERROR_CODES].sort());

    for (const code of WIRE_CLINICAL_ERROR_CODES) {
      const err = new ClinicalError(code, `msg:${code}`);
      expect(err).toBeInstanceOf(Error);
      expect(err.code).toBe(code);
      expect(err.message).toBe(`msg:${code}`);
      expect(err.name).toBe('ClinicalError');
    }

    type DomainCode = (typeof ClinicalError.CODES)[number];
    const equal: AssertEqual<DomainCode, ClinicalErrorCode> = true;
    expect(equal).toBe(true);
  });
});

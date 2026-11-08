import { ClinicalError } from './clinical-error.js';

/** Domain-local. Mirrors CloseConsultaRequest shape without importing @genki/shared. */
export interface ValidateDiagnosticoInput {
  codigo_cie10?: string | null;
  descripcion: string;
  tipo: 'presuntivo' | 'definitivo';
  es_principal: boolean;
}

export interface ValidateTratamientoInput {
  diagnostico_index: number;
  tipo: 'farmacologico' | 'procedimiento' | 'terapia' | 'reposo' | 'dieta';
  descripcion: string;
  indicaciones?: string | null;
  fecha_inicio: string;
  fecha_fin_estimada?: string | null;
  estado: 'activo';
}

export interface ValidateDetalleInput {
  id_medicamento: number;
  dosis?: string;
  via_administracion?: string;
  frecuencia_horas?: number;
  duracion_dias?: number;
  cantidad?: number;
  indicaciones?: string | null;
}

/** Catalog existence/active checks stay out; those become reference_not_found later. */
export interface ValidateConsultaInput {
  id_profesional?: number;
  fecha_hora_inicio: string;
  tipo?: 'primera_vez' | 'seguimiento';
  motivo_consulta?: string;
  enfermedad_actual?: string | null;
  exploracion_fisica?: string | null;
  plan?: string | null;
  diagnosticos: ReadonlyArray<ValidateDiagnosticoInput>;
  tratamientos: ReadonlyArray<ValidateTratamientoInput>;
  receta?: { observaciones?: string | null; detalles: ReadonlyArray<ValidateDetalleInput> } | null;
}

const MAX_BUNDLE_UTF8_BYTES = 256 * 1024;

function invalidBundle(message: string): never {
  throw new ClinicalError('invalid_bundle', message);
}

function utf8JsonSize(value: unknown): number {
  return Buffer.byteLength(JSON.stringify(value), 'utf8');
}

/** Throws ClinicalError invalid_bundle when C1.2 structural bundle rules fail. */
export function validateConsulta(input: ValidateConsultaInput, nowIso: string): void {
  if (utf8JsonSize(input) > MAX_BUNDLE_UTF8_BYTES) {
    invalidBundle('Consultation bundle exceeds 256 KiB UTF-8 JSON');
  }

  const { diagnosticos, tratamientos, fecha_hora_inicio, receta } = input;

  if (diagnosticos.length < 1) {
    invalidBundle('At least one diagnosis is required');
  }

  const principalCount = diagnosticos.filter((d) => d.es_principal).length;
  if (principalCount !== 1) {
    invalidBundle('Exactly one primary diagnosis is required');
  }

  if (fecha_hora_inicio > nowIso) {
    invalidBundle('Consultation start cannot be later than now');
  }

  for (const tratamiento of tratamientos) {
    const index = tratamiento.diagnostico_index;
    if (!Number.isInteger(index) || index < 0 || index >= diagnosticos.length) {
      invalidBundle('Treatment diagnosis index is out of range');
    }
    const end = tratamiento.fecha_fin_estimada;
    if (end != null && end < tratamiento.fecha_inicio) {
      invalidBundle('Treatment end date cannot be before start date');
    }
  }

  for (let i = 0; i < diagnosticos.length; i += 1) {
    const covered = tratamientos.some((t) => t.diagnostico_index === i);
    if (!covered) {
      invalidBundle('Every diagnosis requires at least one treatment');
    }
  }

  if (receta != null) {
    const { detalles } = receta;
    if (detalles.length < 1) {
      invalidBundle('Prescription requires at least one medication detail');
    }
    const seen = new Set<number>();
    for (const detalle of detalles) {
      if (seen.has(detalle.id_medicamento)) {
        invalidBundle('Prescription details must use distinct medication ids');
      }
      seen.add(detalle.id_medicamento);
    }
  }
}

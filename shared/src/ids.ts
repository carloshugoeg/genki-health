/** Branded surrogate keys. Physical SQL types wait for Entrega II migrations (supuesto 15). */

export type InstitutionId = number & { readonly __brand: 'InstitutionId' };
export type PacienteId = number & { readonly __brand: 'PacienteId' };
export type ExpedienteId = number & { readonly __brand: 'ExpedienteId' };
export type ConsultaId = number & { readonly __brand: 'ConsultaId' };
export type DiagnosticoId = number & { readonly __brand: 'DiagnosticoId' };
export type TratamientoId = number & { readonly __brand: 'TratamientoId' };
export type RecetaId = number & { readonly __brand: 'RecetaId' };
export type UsuarioId = number & { readonly __brand: 'UsuarioId' };
export type ProfesionalId = number & { readonly __brand: 'ProfesionalId' };

export function asInstitutionId(value: number): InstitutionId {
  return value as InstitutionId;
}

export function asPacienteId(value: number): PacienteId {
  return value as PacienteId;
}

export function asExpedienteId(value: number): ExpedienteId {
  return value as ExpedienteId;
}

export function asConsultaId(value: number): ConsultaId {
  return value as ConsultaId;
}

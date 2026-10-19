/**
 * Locked institution → engine assignment (E1-06 / architecture 2026-08-27).
 * Agents must not reopen this table.
 */

export type DataEngine = 'postgres' | 'mysql' | 'mongodb' | 'firebase';

export type InstitutionKind =
  'hospital_general' | 'centro_pediatrico' | 'laboratorio_clinico' | 'clinica_odontologica';

export interface InstitutionEngineAssignment {
  readonly kind: InstitutionKind;
  readonly engine: DataEngine;
  /** Spanish display name from the brief. */
  readonly nombre: string;
}

export const INSTITUTION_ENGINE_ASSIGNMENTS: readonly InstitutionEngineAssignment[] = [
  {
    kind: 'hospital_general',
    engine: 'postgres',
    nombre: 'Hospital general',
  },
  {
    kind: 'centro_pediatrico',
    engine: 'mysql',
    nombre: 'Centro médico pediátrico',
  },
  {
    kind: 'laboratorio_clinico',
    engine: 'mongodb',
    nombre: 'Laboratorio clínico',
  },
  {
    kind: 'clinica_odontologica',
    engine: 'firebase',
    nombre: 'Clínica odontológica',
  },
] as const;

export function engineForKind(kind: InstitutionKind): DataEngine {
  const row = INSTITUTION_ENGINE_ASSIGNMENTS.find((item) => item.kind === kind);
  if (!row) {
    throw new Error(`Unknown institution kind: ${kind}`);
  }
  return row.engine;
}

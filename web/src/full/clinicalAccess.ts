/**
 * Client-side mirror of the server role checks for the patient page. The server stays the
 * authority; these lists only keep the UI from firing requests it knows will return 403.
 * Sources: server/src/domain/full/{record,attachments,admission,procedure,discharge,growth,
 * vaccines,milestones,lab-intake,lab-results,dental-chart,dental-plan}.ts and the route guards.
 */
export const ACCESS = {
  /** GET /api/pacientes/:id/ficha, POST alergias/antecedentes (RECORD_CLINICAL_ROLES). */
  ficha: ['medico', 'odontologo', 'enfermeria'],
  /** POST /api/pacientes/:id/documentos (ATTACHMENT_CLINICAL_ROLES). */
  documentos: ['medico', 'odontologo', 'enfermeria'],
  /** GET /api/camas, POST /api/pacientes/:id/admisiones (ADMISSION_ROLES). */
  ingreso: ['medico', 'enfermeria', 'administrador'],
  /** POST /api/admisiones/:id/notas (NOTE_ROLES). */
  nota: ['medico', 'enfermeria'],
  /** POST /api/admisiones/:id/egreso (DISCHARGE_ROLES). */
  egreso: ['medico'],
  /** Perinatal, crecimiento, vacunas, hitos (GROWTH/VACCINE/MILESTONE_ROLES). */
  pediatria: ['medico', 'enfermeria'],
  /** POST /api/laboratorio/ordenes (LAB_INTAKE_ROLES). */
  ordenLaboratorio: ['laboratorista', 'medico', 'administrador'],
  /** GET /api/pacientes/:id/examenes (LAB_RESULT_ROLES). */
  historialExamenes: ['laboratorista', 'medico'],
  /** Odontograma y plan de tratamiento (DENTAL_ROLES). */
  odontologia: ['odontologo'],
} as const satisfies Record<string, readonly string[]>;

export type AccessArea = keyof typeof ACCESS;

export function canAccess(roles: readonly string[], area: AccessArea): boolean {
  if (roles.includes('superadministrador')) return true;
  const allowed: readonly string[] = ACCESS[area];
  return roles.some((role) => allowed.includes(role));
}

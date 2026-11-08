import type {
  ArchiveExpedienteInput,
  ExpedienteDto,
  MotivoArchivo,
  PacienteId,
} from '@genki/shared';
import { ClinicalError } from '../domain/clinical-error.js';
import type { ClockPort, PacienteRepositoryPort } from '../ports/index.js';

const MOTIVOS: ReadonlySet<string> = new Set<MotivoArchivo>([
  'traslado',
  'fallecimiento',
  'administrativo',
  'inactividad',
]);

/**
 * Archives the expediente only. PACIENTE.estado stays activo|inactivo (sección 5);
 * do not write archivado onto the patient row.
 */
export async function archiveExpediente(
  pacientes: PacienteRepositoryPort,
  clock: ClockPort,
  input: Omit<ArchiveExpedienteInput, 'fecha_archivo'> & { id_paciente: PacienteId },
): Promise<ExpedienteDto> {
  if (!MOTIVOS.has(input.motivo_archivo)) {
    throw new ClinicalError('invalid_body', 'Solicitud inválida');
  }
  const paciente = await pacientes.findById(input.id_paciente);
  if (!paciente) {
    throw new ClinicalError('not_found', 'Recurso no encontrado');
  }
  const expediente = await pacientes.findExpedienteByPaciente(input.id_paciente);
  if (!expediente || expediente.id_expediente !== input.id_expediente) {
    throw new ClinicalError('not_found', 'Recurso no encontrado');
  }
  return pacientes.archiveExpediente({
    id_expediente: expediente.id_expediente,
    motivo_archivo: input.motivo_archivo,
    fecha_archivo: clock.nowIso(),
    ...(input.observacion_archivo !== undefined
      ? { observacion_archivo: input.observacion_archivo }
      : {}),
  });
}

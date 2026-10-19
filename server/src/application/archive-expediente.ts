import type { ArchiveExpedienteInput, ExpedienteDto, PacienteId } from '@genki/shared';
import { archivedEstado } from '../domain/expediente-estado.js';
import type { ClockPort, PacienteRepositoryPort } from '../ports/index.js';

/**
 * Archives the expediente only. PACIENTE.estado stays activo|inactivo (sección 5);
 * do not write archivado onto the patient row.
 */
export async function archiveExpediente(
  pacientes: PacienteRepositoryPort,
  clock: ClockPort,
  input: Omit<ArchiveExpedienteInput, 'fecha_archivo'> & { id_paciente: PacienteId },
): Promise<ExpedienteDto> {
  const paciente = await pacientes.findById(input.id_paciente);
  if (!paciente) {
    throw new Error('Paciente not found');
  }
  const archived = await pacientes.archiveExpediente({
    id_expediente: input.id_expediente,
    motivo_archivo: input.motivo_archivo,
    fecha_archivo: clock.nowIso(),
    ...(input.observacion_archivo !== undefined
      ? { observacion_archivo: input.observacion_archivo }
      : {}),
  });
  if (archived.estado !== archivedEstado()) {
    throw new Error('Archive did not set estado=archivado');
  }
  return archived;
}

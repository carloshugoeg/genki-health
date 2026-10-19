import type { ArchiveExpedienteInput, ExpedienteDto, PacienteId } from '@genki/shared';
import { assertCanArchive, archivedEstado } from '../domain/expediente-estado.js';
import type { ClockPort, PacienteRepositoryPort } from '../ports/index.js';

/**
 * Memory-adapter path loads the patient only to confirm the expediente exists.
 * Full expediente fetch belongs on a dedicated port in a later slice.
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
  assertCanArchive(paciente.estado, input.motivo_archivo);
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

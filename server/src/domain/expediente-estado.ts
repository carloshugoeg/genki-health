/** Domain-local. Must match PACIENTE/EXPEDIENTE.estado in Entrega I (activo | archivado). */
export type ExpedienteEstado = 'activo' | 'archivado';

/** Clinical rows are never deleted. Discharge is estado = archivado with a reason. */
export function assertCanArchive(estado: ExpedienteEstado, motivo_archivo: string): void {
  if (estado === 'archivado') {
    throw new Error('Expediente already archivado');
  }
  if (!motivo_archivo.trim()) {
    throw new Error('motivo_archivo is required to archive');
  }
}

export function archivedEstado(): ExpedienteEstado {
  return 'archivado';
}

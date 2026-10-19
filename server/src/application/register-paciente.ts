import type { ExpedienteDto, PacienteDto } from '@genki/shared';
import type { CreatePacienteInput, PacienteRepositoryPort } from '../ports/index.js';

export async function registerPaciente(
  pacientes: PacienteRepositoryPort,
  input: CreatePacienteInput,
): Promise<{ paciente: PacienteDto; expediente: ExpedienteDto }> {
  const existing = await pacientes.findByDocumento(input.tipo_documento, input.numero_documento);
  if (existing) {
    throw new Error('Paciente already exists for document');
  }
  return pacientes.createWithExpediente(input);
}

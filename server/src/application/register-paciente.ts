import type { PacienteResumen } from '@genki/shared';
import { ClinicalError } from '../domain/clinical-error.js';
import type { CreatePacienteInput, PacienteRepositoryPort } from '../ports/index.js';

export async function registerPaciente(
  pacientes: PacienteRepositoryPort,
  input: CreatePacienteInput,
): Promise<PacienteResumen> {
  const existing = await pacientes.findByDocumento(input.tipo_documento, input.numero_documento);
  if (existing) {
    throw new ClinicalError('duplicate_document', 'Documento ya registrado en esta institución');
  }
  return pacientes.createWithExpediente(input);
}

import type { HistorialDto, PacienteId } from '@genki/shared';
import { ClinicalError } from '../domain/clinical-error.js';
import type { ConsultaRepositoryPort, PacienteRepositoryPort } from '../ports/index.js';

export async function getHistorial(
  pacientes: PacienteRepositoryPort,
  consultas: ConsultaRepositoryPort,
  id_paciente: PacienteId,
): Promise<HistorialDto> {
  const paciente = await pacientes.findById(id_paciente);
  if (!paciente) {
    throw new ClinicalError('not_found', 'Recurso no encontrado');
  }
  const expediente = await pacientes.findExpedienteByPaciente(id_paciente);
  if (!expediente) {
    throw new ClinicalError('not_found', 'Recurso no encontrado');
  }
  const consultasList = await consultas.listByExpediente(expediente.id_expediente);
  return { paciente, expediente, consultas: consultasList };
}

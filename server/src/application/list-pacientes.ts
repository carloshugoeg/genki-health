import type { PacientePage } from '@genki/shared';
import type { PacienteRepositoryPort, SearchPacientesInput } from '../ports/index.js';

export async function listPacientes(
  pacientes: PacienteRepositoryPort,
  query: SearchPacientesInput,
): Promise<PacientePage> {
  return pacientes.list(query);
}

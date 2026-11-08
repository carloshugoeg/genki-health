import type {
  ArchiveExpedienteInput,
  ExpedienteDto,
  ExpedienteId,
  PacienteDto,
  PacienteId,
  PacientePage,
  PacienteResumen,
  RegisterPacienteRequest,
} from '@genki/shared';

export type CreatePacienteInput = RegisterPacienteRequest;

export interface SearchPacientesInput {
  q: string;
  estado: 'activo' | 'archivado' | 'todos';
  page: number;
  page_size: number;
}

export interface PacienteRepositoryPort {
  createWithExpediente(input: CreatePacienteInput): Promise<PacienteResumen>;
  findById(id: PacienteId): Promise<PacienteDto | null>;
  findByDocumento(tipo_documento: string, numero_documento: string): Promise<PacienteDto | null>;
  findExpedienteByPaciente(id: PacienteId): Promise<ExpedienteDto | null>;
  findExpedienteById(id: ExpedienteId): Promise<ExpedienteDto | null>;
  list(input: SearchPacientesInput): Promise<PacientePage>;
  archiveExpediente(input: ArchiveExpedienteInput): Promise<ExpedienteDto>;
}

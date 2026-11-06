import type { ArchiveExpedienteInput, ExpedienteDto, PacienteDto, PacienteId } from '@genki/shared';

export interface CreatePacienteInput {
  tipo_documento: string;
  numero_documento: string;
  primer_nombre: string;
  segundo_nombre?: string | null;
  primer_apellido: string;
  segundo_apellido?: string | null;
  fecha_nacimiento: string;
  sexo: PacienteDto['sexo'];
  tipo_sangre?: string | null;
  telefono?: string | null;
  correo?: string | null;
  direccion?: string | null;
  id_municipio?: number | null;
}

export interface PacienteRepositoryPort {
  createWithExpediente(
    input: CreatePacienteInput,
  ): Promise<{ paciente: PacienteDto; expediente: ExpedienteDto }>;
  findById(id: PacienteId): Promise<PacienteDto | null>;
  findByDocumento(tipo_documento: string, numero_documento: string): Promise<PacienteDto | null>;
  archiveExpediente(input: ArchiveExpedienteInput): Promise<ExpedienteDto>;
}

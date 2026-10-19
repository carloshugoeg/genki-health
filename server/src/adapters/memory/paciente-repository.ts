import type {
  ArchiveExpedienteInput,
  ExpedienteDto,
  InstitutionId,
  PacienteDto,
  PacienteId,
} from '@genki/shared';
import { asExpedienteId, asPacienteId } from '@genki/shared';
import type { CreatePacienteInput, IdPort, PacienteRepositoryPort } from '../../ports/index.js';
import { archivedEstado } from '../../domain/expediente-estado.js';

export class MemoryPacienteRepository implements PacienteRepositoryPort {
  private readonly pacientes = new Map<PacienteId, PacienteDto>();
  private readonly expedientes = new Map<PacienteId, ExpedienteDto>();

  constructor(
    private readonly ids: IdPort,
    private readonly id_institucion: InstitutionId,
    private readonly nowIso: () => string,
  ) {}

  async createWithExpediente(
    input: CreatePacienteInput,
  ): Promise<{ paciente: PacienteDto; expediente: ExpedienteDto }> {
    const id_paciente = asPacienteId(await this.ids.nextInt('paciente'));
    const id_expediente = asExpedienteId(await this.ids.nextInt('expediente'));
    const fecha = this.nowIso();

    const paciente: PacienteDto = {
      id_paciente,
      id_institucion: this.id_institucion,
      tipo_documento: input.tipo_documento,
      numero_documento: input.numero_documento,
      primer_nombre: input.primer_nombre,
      segundo_nombre: input.segundo_nombre ?? null,
      primer_apellido: input.primer_apellido,
      segundo_apellido: input.segundo_apellido ?? null,
      fecha_nacimiento: input.fecha_nacimiento,
      sexo: input.sexo,
      tipo_sangre: input.tipo_sangre ?? null,
      telefono: input.telefono ?? null,
      correo: input.correo ?? null,
      direccion: input.direccion ?? null,
      id_municipio: input.id_municipio ?? null,
      fecha_registro: fecha,
      estado: 'activo',
    };

    const expediente: ExpedienteDto = {
      id_expediente,
      id_paciente,
      numero_expediente: `EXP-${id_expediente}`,
      fecha_apertura: fecha,
      estado: 'activo',
      fecha_archivo: null,
      motivo_archivo: null,
      observacion_archivo: null,
    };

    this.pacientes.set(id_paciente, paciente);
    this.expedientes.set(id_paciente, expediente);
    return { paciente, expediente };
  }

  async findById(id: PacienteId): Promise<PacienteDto | null> {
    return this.pacientes.get(id) ?? null;
  }

  async findByDocumento(
    tipo_documento: string,
    numero_documento: string,
  ): Promise<PacienteDto | null> {
    for (const paciente of this.pacientes.values()) {
      if (
        paciente.tipo_documento === tipo_documento &&
        paciente.numero_documento === numero_documento
      ) {
        return paciente;
      }
    }
    return null;
  }

  async archiveExpediente(input: ArchiveExpedienteInput): Promise<ExpedienteDto> {
    for (const [pacienteId, expediente] of this.expedientes.entries()) {
      if (expediente.id_expediente !== input.id_expediente) {
        continue;
      }
      const next: ExpedienteDto = {
        ...expediente,
        estado: archivedEstado(),
        fecha_archivo: input.fecha_archivo,
        motivo_archivo: input.motivo_archivo,
        observacion_archivo: input.observacion_archivo ?? null,
      };
      this.expedientes.set(pacienteId, next);
      const paciente = this.pacientes.get(pacienteId);
      if (paciente) {
        this.pacientes.set(pacienteId, { ...paciente, estado: archivedEstado() });
      }
      return next;
    }
    throw new Error('Expediente not found');
  }
}

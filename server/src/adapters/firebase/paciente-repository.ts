import {
  asExpedienteId,
  asPacienteId,
  type ArchiveExpedienteInput,
  type ExpedienteDto,
  type ExpedienteId,
  type InstitutionId,
  type InstitutionKind,
  type PacienteDto,
  type PacienteId,
  type PacientePage,
  type PacienteResumen,
  type ReactivateExpedienteInput,
  type ResponsableInput,
} from '@genki/shared';
import { ClinicalError } from '../../domain/clinical-error.js';
import type {
  CreatePacienteInput,
  IdPort,
  PacienteRepositoryPort,
  SearchPacientesInput,
} from '../../ports/index.js';
import { documentKey } from './mapper.js';
import type { FirebaseUnitOfWork } from './unit-of-work.js';

function optionalText(value: string | null | undefined): string | null {
  return value?.trim() || null;
}
function normalizeDocumento(value: string): string {
  return value.trim().toUpperCase();
}
function guardians(kind: InstitutionKind, input: ResponsableInput[] = []): ResponsableInput[] {
  if (kind === 'centro_pediatrico' && input.length === 0) {
    throw new ClinicalError('guardian_required', 'Se requiere responsable principal');
  }
  if (
    (kind === 'centro_pediatrico' && input.filter((r) => r.es_principal).length !== 1) ||
    (kind !== 'centro_pediatrico' && input.length > 0)
  ) {
    throw new ClinicalError(
      'invalid_guardians',
      'Debe existir exactamente un responsable principal',
    );
  }
  return input;
}
function recordDto(row: Record<string, unknown>): ExpedienteDto {
  return {
    id_expediente: row.id_expediente as ExpedienteId,
    id_paciente: row.id_paciente as PacienteId,
    numero_expediente: row.numero_expediente as string,
    fecha_apertura: row.fecha_apertura as string,
    estado: row.estado as ExpedienteDto['estado'],
    fecha_archivo: row.fecha_archivo as string | null,
    motivo_archivo: row.motivo_archivo as ExpedienteDto['motivo_archivo'],
    observacion_archivo: row.observacion_archivo as string | null,
  };
}

/** Institution-local patient aggregate; all compound writes join the buffered native UoW. */
export class FirebasePacienteRepository implements PacienteRepositoryPort {
  constructor(
    private readonly unitOfWork: FirebaseUnitOfWork,
    private readonly ids: IdPort,
    private readonly id_institucion: InstitutionId,
    private readonly kind: InstitutionKind,
    private readonly nowIso: () => string,
  ) {}

  async createWithExpediente(input: CreatePacienteInput): Promise<PacienteResumen> {
    return this.unitOfWork.runInTransaction(async () => {
      const responsables = guardians(this.kind, input.responsables);
      const numero = normalizeDocumento(input.numero_documento);
      const key = documentKey(numero);
      if (
        (await this.unitOfWork.read('documentKeys', key)) ||
        (await this.findByDocumento(input.tipo_documento, numero))
      ) {
        throw new ClinicalError(
          'duplicate_document',
          'Documento ya registrado en esta institución',
        );
      }
      if (
        input.id_municipio != null &&
        !(await this.unitOfWork.read('municipios', input.id_municipio))
      ) {
        throw new ClinicalError('reference_not_found', 'Municipio no encontrado');
      }
      const id_paciente = asPacienteId(await this.ids.nextInt('paciente'));
      const id_expediente = asExpedienteId(await this.ids.nextInt('expediente'));
      const fecha = this.nowIso();
      const paciente: PacienteDto = {
        id_paciente,
        id_institucion: this.id_institucion,
        tipo_documento: input.tipo_documento,
        numero_documento: numero,
        primer_nombre: input.primer_nombre.trim(),
        segundo_nombre: optionalText(input.segundo_nombre),
        primer_apellido: input.primer_apellido.trim(),
        segundo_apellido: optionalText(input.segundo_apellido),
        fecha_nacimiento: input.fecha_nacimiento,
        sexo: input.sexo,
        tipo_sangre: optionalText(input.tipo_sangre),
        telefono: optionalText(input.telefono),
        correo: optionalText(input.correo),
        direccion: optionalText(input.direccion),
        id_municipio: input.id_municipio ?? null,
        fecha_registro: fecha,
        estado: 'activo',
      };
      await this.unitOfWork.create('documentKeys', key, { id_paciente, numero_documento: numero });
      await this.unitOfWork.create('patients', id_paciente, paciente, 'afterPaciente');
      for (const responsable of responsables) {
        const id_responsable = await this.ids.nextInt('responsable');
        await this.unitOfWork.create('responsibles', id_responsable, {
          ...responsable,
          id_responsable,
          id_paciente,
          correo: optionalText(responsable.correo),
          direccion: optionalText(responsable.direccion),
        });
      }
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
      await this.unitOfWork.create('records', id_expediente, { ...expediente, revision: 0 });
      return structuredClone({ paciente, expediente });
    });
  }

  async findById(id: PacienteId): Promise<PacienteDto | null> {
    const row = await this.unitOfWork.read('patients', id);
    return row as PacienteDto | null;
  }

  async findByDocumento(
    _tipo_documento: string,
    numero_documento: string,
  ): Promise<PacienteDto | null> {
    const numero = normalizeDocumento(numero_documento);
    const rows = await this.unitOfWork.query('patients', (row) => row.numero_documento === numero);
    return (rows[0] as PacienteDto | undefined) ?? null;
  }

  async findExpedienteByPaciente(id: PacienteId): Promise<ExpedienteDto | null> {
    const rows = await this.unitOfWork.query('records', (row) => row.id_paciente === id);
    return rows[0] ? recordDto(rows[0]) : null;
  }

  async findExpedienteById(id: ExpedienteId): Promise<ExpedienteDto | null> {
    const row = await this.unitOfWork.read('records', id);
    return row ? recordDto(row) : null;
  }

  async list(input: SearchPacientesInput): Promise<PacientePage> {
    return this.unitOfWork.runInTransaction(async () => {
      const patients = await this.unitOfWork.query('patients');
      const records = await this.unitOfWork.query('records');
      const byPatient = new Map(records.map((row) => [row.id_paciente, recordDto(row)]));
      const query = input.q.trim();
      const rows: PacienteResumen[] = [];
      for (const row of patients) {
        const paciente = row as PacienteDto;
        const expediente = byPatient.get(paciente.id_paciente);
        if (!expediente || (input.estado !== 'todos' && expediente.estado !== input.estado))
          continue;
        const name = [
          paciente.primer_nombre,
          paciente.segundo_nombre,
          paciente.primer_apellido,
          paciente.segundo_apellido,
        ]
          .filter((part) => part != null && part.trim() !== '')
          .join(' ');
        if (
          query &&
          paciente.numero_documento !== normalizeDocumento(query) &&
          expediente.numero_expediente !== query &&
          !name.toLowerCase().includes(query.toLowerCase())
        )
          continue;
        rows.push({ paciente, expediente });
      }
      rows.sort((a, b) => a.paciente.id_paciente - b.paciente.id_paciente);
      const start = (input.page - 1) * input.page_size;
      return {
        items: rows.slice(start, start + input.page_size),
        total: rows.length,
        page: input.page,
        page_size: input.page_size,
      };
    });
  }

  async archiveExpediente(input: ArchiveExpedienteInput): Promise<ExpedienteDto> {
    return this.unitOfWork.runInTransaction(async () => {
      const row = await this.unitOfWork.read('records', input.id_expediente);
      if (!row) throw new ClinicalError('not_found', 'Recurso no encontrado');
      if (row.estado === 'archivado') {
        throw new ClinicalError('already_archived', 'El expediente ya está archivado');
      }
      const expediente: ExpedienteDto = {
        ...recordDto(row),
        estado: 'archivado',
        fecha_archivo: input.fecha_archivo,
        motivo_archivo: input.motivo_archivo,
        observacion_archivo: input.observacion_archivo ?? null,
      };
      await this.unitOfWork.update('records', input.id_expediente, {
        ...expediente,
        revision: row.revision + 1,
      });
      return expediente;
    });
  }

  async reactivateExpediente(input: ReactivateExpedienteInput): Promise<ExpedienteDto> {
    return this.unitOfWork.runInTransaction(async () => {
      const row = await this.unitOfWork.read('records', input.id_expediente);
      if (!row) throw new ClinicalError('not_found', 'Recurso no encontrado');
      if (row.estado !== 'archivado') {
        throw new ClinicalError('conflict', 'Conflicto de recurso');
      }
      const expediente: ExpedienteDto = {
        ...recordDto(row),
        estado: 'activo',
        fecha_archivo: null,
        motivo_archivo: null,
        observacion_archivo: null,
      };
      await this.unitOfWork.update('records', input.id_expediente, {
        ...expediente,
        revision: row.revision + 1,
      });
      return expediente;
    });
  }
}

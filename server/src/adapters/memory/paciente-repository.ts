import type {
  ArchiveExpedienteInput,
  ExpedienteDto,
  ExpedienteId,
  InstitutionId,
  InstitutionKind,
  PacienteDto,
  PacienteId,
  PacientePage,
  PacienteResumen,
  ResponsableInput,
} from '@genki/shared';
import { asExpedienteId, asPacienteId } from '@genki/shared';
import { ClinicalError } from '../../domain/clinical-error.js';
import { archivedEstado } from '../../domain/expediente-estado.js';
import type {
  CreatePacienteInput,
  IdPort,
  PacienteRepositoryPort,
  PersistenceCheckpoint,
  SearchPacientesInput,
  UnitOfWorkPort,
} from '../../ports/index.js';
import type { MemoryMaps } from './state.js';
import type { MemoryInstitutionState } from './state.js';
import { activeMemoryMaps } from './unit-of-work.js';

const DUPLICATE_DOCUMENT = 'Documento ya registrado en esta institución';
const GUARDIAN_REQUIRED = 'Se requiere responsable principal';
const INVALID_GUARDIANS = 'Debe existir exactamente un responsable principal';
const ALREADY_ARCHIVED = 'El expediente ya está archivado';
const NOT_FOUND = 'Recurso no encontrado';

interface ResponsableRecord {
  id_responsable: number;
  id_paciente: PacienteId;
  tipo_documento: string;
  numero_documento: string;
  nombre_completo: string;
  parentesco: ResponsableInput['parentesco'];
  telefono: string;
  correo: string | null;
  direccion: string | null;
  es_principal: boolean;
}

function cloneDto<T>(value: T): T {
  return structuredClone(value);
}

function normalizeDocumento(value: string): string {
  return value.trim().toUpperCase();
}

function requiredText(value: string): string {
  return value.trim();
}

function optionalText(value: string | null | undefined): string | null {
  if (value == null) {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length === 0 ? null : trimmed;
}

function assertGuardians(
  kind: InstitutionKind,
  responsables: ResponsableInput[] | undefined,
): ResponsableInput[] {
  const list = responsables ?? [];
  if (kind === 'centro_pediatrico') {
    if (list.length === 0) {
      throw new ClinicalError('guardian_required', GUARDIAN_REQUIRED);
    }
    const principals = list.filter((row) => row.es_principal).length;
    if (principals !== 1) {
      throw new ClinicalError('invalid_guardians', INVALID_GUARDIANS);
    }
    return list;
  }
  if (list.length > 0) {
    throw new ClinicalError('invalid_guardians', INVALID_GUARDIANS);
  }
  return [];
}

function findDocumentoIn(maps: MemoryMaps, numero: string): PacienteDto | undefined {
  for (const paciente of maps.pacientes.values()) {
    if (paciente.numero_documento === numero) {
      return paciente;
    }
  }
  return undefined;
}

function joinedName(paciente: PacienteDto): string {
  return [
    paciente.primer_nombre,
    paciente.segundo_nombre,
    paciente.primer_apellido,
    paciente.segundo_apellido,
  ]
    .filter((part): part is string => part != null && part.trim() !== '')
    .join(' ');
}

function matchesQuery(paciente: PacienteDto, expediente: ExpedienteDto, q: string): boolean {
  const query = q.trim();
  if (query.length === 0) {
    return true;
  }
  if (paciente.numero_documento === normalizeDocumento(query)) {
    return true;
  }
  if (expediente.numero_expediente === query) {
    return true;
  }
  return joinedName(paciente).toLowerCase().includes(query.toLowerCase());
}

export class MemoryPacienteRepository implements PacienteRepositoryPort {
  constructor(
    private readonly state: MemoryInstitutionState,
    private readonly ids: IdPort,
    private readonly unitOfWork: UnitOfWorkPort,
    private readonly id_institucion: InstitutionId,
    private readonly kind: InstitutionKind,
    private readonly nowIso: () => string,
    private readonly afterWrite: (point: PersistenceCheckpoint) => void = () => {},
  ) {}

  async createWithExpediente(input: CreatePacienteInput): Promise<PacienteResumen> {
    return this.unitOfWork.runInTransaction(async () => {
      const responsables = assertGuardians(this.kind, input.responsables);
      const maps = activeMemoryMaps(this.state);
      const numero = normalizeDocumento(input.numero_documento);
      if (findDocumentoIn(maps, numero)) {
        throw new ClinicalError('duplicate_document', DUPLICATE_DOCUMENT);
      }

      const id_paciente = asPacienteId(await this.ids.nextInt('paciente'));
      const id_expediente = asExpedienteId(await this.ids.nextInt('expediente'));
      const fecha = this.nowIso();
      const paciente: PacienteDto = {
        id_paciente,
        id_institucion: this.id_institucion,
        tipo_documento: input.tipo_documento,
        numero_documento: numero,
        primer_nombre: requiredText(input.primer_nombre),
        segundo_nombre: optionalText(input.segundo_nombre),
        primer_apellido: requiredText(input.primer_apellido),
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
      maps.pacientes.set(id_paciente, paciente);
      this.afterWrite('afterPaciente');

      for (const responsable of responsables) {
        const id_responsable = await this.ids.nextInt('responsable');
        const row: ResponsableRecord = {
          id_responsable,
          id_paciente,
          tipo_documento: responsable.tipo_documento,
          numero_documento: responsable.numero_documento,
          nombre_completo: responsable.nombre_completo,
          parentesco: responsable.parentesco,
          telefono: responsable.telefono,
          correo: optionalText(responsable.correo),
          direccion: optionalText(responsable.direccion),
          es_principal: responsable.es_principal,
        };
        maps.responsables.set(id_responsable, row);
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
      maps.expedientes.set(id_paciente, expediente);
      return { paciente: cloneDto(paciente), expediente: cloneDto(expediente) };
    });
  }

  async findById(id: PacienteId): Promise<PacienteDto | null> {
    const found = activeMemoryMaps(this.state).pacientes.get(id);
    return found ? cloneDto(found) : null;
  }

  async findByDocumento(
    _tipo_documento: string,
    numero_documento: string,
  ): Promise<PacienteDto | null> {
    const found = findDocumentoIn(
      activeMemoryMaps(this.state),
      normalizeDocumento(numero_documento),
    );
    return found ? cloneDto(found) : null;
  }

  async findExpedienteByPaciente(id: PacienteId): Promise<ExpedienteDto | null> {
    const found = activeMemoryMaps(this.state).expedientes.get(id);
    return found ? cloneDto(found) : null;
  }

  async findExpedienteById(id: ExpedienteId): Promise<ExpedienteDto | null> {
    for (const expediente of activeMemoryMaps(this.state).expedientes.values()) {
      if (expediente.id_expediente === id) {
        return cloneDto(expediente);
      }
    }
    return null;
  }

  async list(input: SearchPacientesInput): Promise<PacientePage> {
    const maps = activeMemoryMaps(this.state);
    const rows: PacienteResumen[] = [];
    for (const paciente of maps.pacientes.values()) {
      const expediente = maps.expedientes.get(paciente.id_paciente);
      if (!expediente) {
        continue;
      }
      if (input.estado !== 'todos' && expediente.estado !== input.estado) {
        continue;
      }
      if (!matchesQuery(paciente, expediente, input.q)) {
        continue;
      }
      rows.push({ paciente, expediente });
    }
    rows.sort((a, b) => a.paciente.id_paciente - b.paciente.id_paciente);
    const start = (input.page - 1) * input.page_size;
    const items = rows.slice(start, start + input.page_size).map((row) => ({
      paciente: cloneDto(row.paciente),
      expediente: cloneDto(row.expediente),
    }));
    return {
      items,
      page: input.page,
      page_size: input.page_size,
      total: rows.length,
    };
  }

  async archiveExpediente(input: ArchiveExpedienteInput): Promise<ExpedienteDto> {
    return this.unitOfWork.runInTransaction(async () => {
      const maps = activeMemoryMaps(this.state);
      for (const [pacienteId, expediente] of maps.expedientes.entries()) {
        if (expediente.id_expediente !== input.id_expediente) {
          continue;
        }
        if (expediente.estado === 'archivado') {
          throw new ClinicalError('already_archived', ALREADY_ARCHIVED);
        }
        const next: ExpedienteDto = {
          ...expediente,
          estado: archivedEstado(),
          fecha_archivo: input.fecha_archivo,
          motivo_archivo: input.motivo_archivo,
          observacion_archivo: input.observacion_archivo ?? null,
        };
        maps.expedientes.set(pacienteId, next);
        return cloneDto(next);
      }
      throw new ClinicalError('not_found', NOT_FOUND);
    });
  }
}

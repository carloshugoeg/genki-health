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
import { asExpedienteId, asInstitutionId, asPacienteId } from '@genki/shared';
import type { Db, Document, FindOptions, InsertOneOptions, UpdateOptions } from 'mongodb';
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
import {
  asPlainInt,
  fromBsonDate,
  makeDocumentId,
  toBsonDate,
  toBsonInt,
  type MongoStringIdDoc,
} from './mapper.js';
import { activeMongoSession } from './unit-of-work.js';

const DUPLICATE_DOCUMENT = 'Documento ya registrado en esta institución';
const GUARDIAN_REQUIRED = 'Se requiere responsable principal';
const INVALID_GUARDIANS = 'Debe existir exactamente un responsable principal';
const ALREADY_ARCHIVED = 'El expediente ya está archivado';
const NOT_FOUND = 'Recurso no encontrado';

function sessionOpts():
  | Pick<FindOptions, 'session'>
  | Pick<InsertOneOptions, 'session'>
  | Pick<UpdateOptions, 'session'>
  | Record<string, never> {
  const session = activeMongoSession();
  return session ? { session } : {};
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

function isDuplicateKey(error: unknown): boolean {
  return typeof error === 'object' && error !== null && (error as { code?: number }).code === 11000;
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

function pacienteFromDoc(doc: Document): PacienteDto {
  return {
    id_paciente: asPacienteId(asPlainInt(doc.id_paciente)),
    id_institucion: asInstitutionId(asPlainInt(doc.id_institucion)),
    tipo_documento: String(doc.tipo_documento),
    numero_documento: String(doc.numero_documento),
    primer_nombre: String(doc.primer_nombre),
    segundo_nombre: doc.segundo_nombre == null ? null : String(doc.segundo_nombre),
    primer_apellido: String(doc.primer_apellido),
    segundo_apellido: doc.segundo_apellido == null ? null : String(doc.segundo_apellido),
    fecha_nacimiento: String(doc.fecha_nacimiento),
    sexo: doc.sexo as PacienteDto['sexo'],
    tipo_sangre: doc.tipo_sangre == null ? null : String(doc.tipo_sangre),
    telefono: doc.telefono == null ? null : String(doc.telefono),
    correo: doc.correo == null ? null : String(doc.correo),
    direccion: doc.direccion == null ? null : String(doc.direccion),
    id_municipio: doc.id_municipio == null ? null : asPlainInt(doc.id_municipio),
    fecha_registro: fromBsonDate(doc.fecha_registro as Date | string),
    estado: doc.estado as PacienteDto['estado'],
  };
}

function expedienteFromDoc(doc: Document): ExpedienteDto {
  return {
    id_expediente: asExpedienteId(asPlainInt(doc.id_expediente)),
    id_paciente: asPacienteId(asPlainInt(doc.id_paciente)),
    numero_expediente: String(doc.numero_expediente),
    fecha_apertura: fromBsonDate(doc.fecha_apertura as Date | string),
    estado: doc.estado as ExpedienteDto['estado'],
    fecha_archivo:
      doc.fecha_archivo == null ? null : fromBsonDate(doc.fecha_archivo as Date | string),
    motivo_archivo:
      doc.motivo_archivo == null ? null : (doc.motivo_archivo as ExpedienteDto['motivo_archivo']),
    observacion_archivo: doc.observacion_archivo == null ? null : String(doc.observacion_archivo),
  };
}

export class MongoPacienteRepository implements PacienteRepositoryPort {
  constructor(
    private readonly db: Db,
    private readonly id_institucion: InstitutionId,
    private readonly kind: InstitutionKind,
    private readonly ids: IdPort,
    private readonly unitOfWork: UnitOfWorkPort,
    private readonly nowIso: () => string,
    private readonly afterWrite: (point: PersistenceCheckpoint) => void = () => {},
  ) {}

  private institutionFilter(): Document {
    return { institution_id: toBsonInt(this.id_institucion) };
  }

  async createWithExpediente(input: CreatePacienteInput): Promise<PacienteResumen> {
    return this.unitOfWork.runInTransaction(async () => {
      const responsables = assertGuardians(this.kind, input.responsables);
      const opts = sessionOpts();
      const numero = normalizeDocumento(input.numero_documento);
      const existing = await this.db
        .collection<MongoStringIdDoc>('pacientes')
        .findOne({ ...this.institutionFilter(), numero_documento: numero }, opts);
      if (existing) {
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

      try {
        await this.db.collection<MongoStringIdDoc>('pacientes').insertOne(
          {
            _id: makeDocumentId(this.id_institucion, id_paciente),
            institution_id: toBsonInt(this.id_institucion),
            id_paciente: toBsonInt(id_paciente),
            id_institucion: toBsonInt(this.id_institucion),
            tipo_documento: paciente.tipo_documento,
            numero_documento: paciente.numero_documento,
            primer_nombre: paciente.primer_nombre,
            segundo_nombre: paciente.segundo_nombre,
            primer_apellido: paciente.primer_apellido,
            segundo_apellido: paciente.segundo_apellido,
            fecha_nacimiento: paciente.fecha_nacimiento,
            sexo: paciente.sexo,
            tipo_sangre: paciente.tipo_sangre,
            telefono: paciente.telefono,
            correo: paciente.correo,
            direccion: paciente.direccion,
            id_municipio: paciente.id_municipio == null ? null : toBsonInt(paciente.id_municipio),
            fecha_registro: toBsonDate(paciente.fecha_registro),
            estado: paciente.estado,
          },
          opts,
        );
      } catch (error) {
        if (isDuplicateKey(error)) {
          throw new ClinicalError('duplicate_document', DUPLICATE_DOCUMENT);
        }
        throw error;
      }

      this.afterWrite('afterPaciente');

      for (const responsable of responsables) {
        const id_responsable = await this.ids.nextInt('responsable');
        await this.db.collection<MongoStringIdDoc>('responsables').insertOne(
          {
            _id: makeDocumentId(this.id_institucion, id_responsable),
            institution_id: toBsonInt(this.id_institucion),
            id_responsable: toBsonInt(id_responsable),
            id_paciente: toBsonInt(id_paciente),
            tipo_documento: responsable.tipo_documento,
            numero_documento: responsable.numero_documento,
            nombre_completo: responsable.nombre_completo,
            parentesco: responsable.parentesco,
            telefono: responsable.telefono,
            correo: optionalText(responsable.correo),
            direccion: optionalText(responsable.direccion),
            es_principal: responsable.es_principal,
          },
          opts,
        );
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

      await this.db.collection<MongoStringIdDoc>('expedientes').insertOne(
        {
          _id: makeDocumentId(this.id_institucion, id_expediente),
          institution_id: toBsonInt(this.id_institucion),
          id_expediente: toBsonInt(id_expediente),
          id_paciente: toBsonInt(id_paciente),
          numero_expediente: expediente.numero_expediente,
          fecha_apertura: toBsonDate(expediente.fecha_apertura),
          estado: expediente.estado,
          fecha_archivo: null,
          motivo_archivo: null,
          observacion_archivo: null,
          _rev: toBsonInt(1),
        },
        opts,
      );

      return { paciente: cloneDto(paciente), expediente: cloneDto(expediente) };
    });
  }

  async findById(id: PacienteId): Promise<PacienteDto | null> {
    const doc = await this.db
      .collection<MongoStringIdDoc>('pacientes')
      .findOne({ ...this.institutionFilter(), id_paciente: toBsonInt(id) }, sessionOpts());
    return doc ? cloneDto(pacienteFromDoc(doc)) : null;
  }

  async findByDocumento(
    _tipo_documento: string,
    numero_documento: string,
  ): Promise<PacienteDto | null> {
    const doc = await this.db.collection<MongoStringIdDoc>('pacientes').findOne(
      {
        ...this.institutionFilter(),
        numero_documento: normalizeDocumento(numero_documento),
      },
      sessionOpts(),
    );
    return doc ? cloneDto(pacienteFromDoc(doc)) : null;
  }

  async findExpedienteByPaciente(id: PacienteId): Promise<ExpedienteDto | null> {
    const doc = await this.db
      .collection<MongoStringIdDoc>('expedientes')
      .findOne({ ...this.institutionFilter(), id_paciente: toBsonInt(id) }, sessionOpts());
    return doc ? cloneDto(expedienteFromDoc(doc)) : null;
  }

  async findExpedienteById(id: ExpedienteId): Promise<ExpedienteDto | null> {
    const doc = await this.db
      .collection<MongoStringIdDoc>('expedientes')
      .findOne({ ...this.institutionFilter(), id_expediente: toBsonInt(id) }, sessionOpts());
    return doc ? cloneDto(expedienteFromDoc(doc)) : null;
  }

  async list(input: SearchPacientesInput): Promise<PacientePage> {
    const opts = sessionOpts();
    const filter = this.institutionFilter();
    const [pacienteDocs, expedienteDocs] = await Promise.all([
      this.db.collection<MongoStringIdDoc>('pacientes').find(filter, opts).toArray(),
      this.db.collection<MongoStringIdDoc>('expedientes').find(filter, opts).toArray(),
    ]);
    const expedientesByPaciente = new Map<number, ExpedienteDto>();
    for (const doc of expedienteDocs) {
      const expediente = expedienteFromDoc(doc);
      expedientesByPaciente.set(expediente.id_paciente, expediente);
    }

    const rows: PacienteResumen[] = [];
    for (const doc of pacienteDocs) {
      const paciente = pacienteFromDoc(doc);
      const expediente = expedientesByPaciente.get(paciente.id_paciente);
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
      const opts = sessionOpts();
      const existing = await this.db.collection<MongoStringIdDoc>('expedientes').findOne(
        {
          ...this.institutionFilter(),
          id_expediente: toBsonInt(input.id_expediente),
        },
        opts,
      );
      if (!existing) {
        throw new ClinicalError('not_found', NOT_FOUND);
      }
      if (String(existing.estado) === 'archivado') {
        throw new ClinicalError('already_archived', ALREADY_ARCHIVED);
      }

      const currentRev = asPlainInt(existing._rev);
      const updated = await this.db.collection<MongoStringIdDoc>('expedientes').findOneAndUpdate(
        {
          _id: existing._id,
          institution_id: toBsonInt(this.id_institucion),
          estado: 'activo',
          _rev: existing._rev,
        },
        {
          $set: {
            estado: archivedEstado(),
            fecha_archivo: toBsonDate(input.fecha_archivo),
            motivo_archivo: input.motivo_archivo,
            observacion_archivo: input.observacion_archivo ?? null,
            _rev: toBsonInt(currentRev + 1),
          },
        },
        { returnDocument: 'after', ...opts },
      );
      if (!updated) {
        throw new ClinicalError('already_archived', ALREADY_ARCHIVED);
      }
      return cloneDto(expedienteFromDoc(updated));
    });
  }
}

import type {
  ArchiveExpedienteInput,
  ExpedienteDto,
  ExpedienteId,
  InstitutionId,
  InstitutionKind,
  MotivoArchivo,
  PacienteDto,
  PacienteId,
  PacientePage,
  PacienteResumen,
  ResponsableInput,
  Sexo,
} from '@genki/shared';
import { asExpedienteId, asInstitutionId, asPacienteId } from '@genki/shared';
import { DatabaseError } from 'pg';
import { ClinicalError } from '../../domain/clinical-error.js';
import { archivedEstado } from '../../domain/expediente-estado.js';
import type {
  CreatePacienteInput,
  PacienteRepositoryPort,
  PersistenceCheckpoint,
  SearchPacientesInput,
  UnitOfWorkPort,
} from '../../ports/index.js';
import { fromPgDate, fromPgTimestamptz, toPgDate, toPgTimestamptz } from './mapper.js';
import { postgresQuery } from './unit-of-work.js';

const DUPLICATE_DOCUMENT = 'Documento ya registrado en esta institución';
const GUARDIAN_REQUIRED = 'Se requiere responsable principal';
const INVALID_GUARDIANS = 'Debe existir exactamente un responsable principal';
const ALREADY_ARCHIVED = 'El expediente ya está archivado';
const NOT_FOUND = 'Recurso no encontrado';
const DOCUMENT_CONSTRAINT = 'uq_paciente_documento';

interface PacienteRow {
  id_paciente: number;
  id_institucion: number;
  tipo_documento: string;
  numero_documento: string;
  primer_nombre: string;
  segundo_nombre: string | null;
  primer_apellido: string;
  segundo_apellido: string | null;
  fecha_nacimiento: string | Date;
  sexo: Sexo;
  tipo_sangre: string | null;
  telefono: string | null;
  correo: string | null;
  direccion: string | null;
  id_municipio: number | null;
  fecha_registro: string | Date;
  estado: 'activo' | 'inactivo';
}

interface ExpedienteRow {
  id_expediente: number;
  id_paciente: number;
  numero_expediente: string;
  fecha_apertura: string | Date;
  estado: 'activo' | 'archivado';
  fecha_archivo: string | Date | null;
  motivo_archivo: MotivoArchivo | null;
  observacion_archivo: string | null;
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

function mapPaciente(row: PacienteRow): PacienteDto {
  return {
    id_paciente: asPacienteId(row.id_paciente),
    id_institucion: asInstitutionId(row.id_institucion),
    tipo_documento: row.tipo_documento,
    numero_documento: row.numero_documento,
    primer_nombre: row.primer_nombre,
    segundo_nombre: row.segundo_nombre,
    primer_apellido: row.primer_apellido,
    segundo_apellido: row.segundo_apellido,
    fecha_nacimiento: fromPgDate(row.fecha_nacimiento),
    sexo: row.sexo,
    tipo_sangre: row.tipo_sangre,
    telefono: row.telefono,
    correo: row.correo,
    direccion: row.direccion,
    id_municipio: row.id_municipio,
    fecha_registro: fromPgTimestamptz(row.fecha_registro),
    estado: row.estado,
  };
}

function mapExpediente(row: ExpedienteRow): ExpedienteDto {
  return {
    id_expediente: asExpedienteId(row.id_expediente),
    id_paciente: asPacienteId(row.id_paciente),
    numero_expediente: row.numero_expediente,
    fecha_apertura: fromPgTimestamptz(row.fecha_apertura),
    estado: row.estado,
    fecha_archivo: row.fecha_archivo == null ? null : fromPgTimestamptz(row.fecha_archivo),
    motivo_archivo: row.motivo_archivo,
    observacion_archivo: row.observacion_archivo,
  };
}

function escapeLikeLiteral(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_');
}

function isDuplicateDocumentError(error: unknown): boolean {
  return (
    error instanceof DatabaseError &&
    error.code === '23505' &&
    error.constraint === DOCUMENT_CONSTRAINT
  );
}

/**
 * Hospital PostgreSQL patient adapter (C3 / C4a): registration, scoped
 * read/search, and archive. Compound writes run inside UnitOfWork.
 */
export class PostgresPacienteRepository implements PacienteRepositoryPort {
  constructor(
    private readonly id_institucion: InstitutionId,
    private readonly kind: InstitutionKind,
    private readonly unitOfWork: UnitOfWorkPort,
    private readonly nowIso: () => string,
    private readonly afterWrite: (point: PersistenceCheckpoint) => void = () => {},
  ) {}

  async createWithExpediente(input: CreatePacienteInput): Promise<PacienteResumen> {
    return this.unitOfWork.runInTransaction(async () => {
      const responsables = assertGuardians(this.kind, input.responsables);
      const numero = normalizeDocumento(input.numero_documento);
      const fecha = this.nowIso();

      let pacienteRow: PacienteRow;
      try {
        const inserted = await postgresQuery<PacienteRow>(
          `INSERT INTO paciente (
             id_institucion, tipo_documento, numero_documento,
             primer_nombre, segundo_nombre, primer_apellido, segundo_apellido,
             fecha_nacimiento, sexo, tipo_sangre, telefono, correo, direccion,
             id_municipio, fecha_registro, estado
           ) VALUES (
             $1, $2, $3,
             $4, $5, $6, $7,
             $8::date, $9, $10, $11, $12, $13,
             $14, $15::timestamptz, 'activo'
           )
           RETURNING *`,
          [
            this.id_institucion,
            input.tipo_documento,
            numero,
            requiredText(input.primer_nombre),
            optionalText(input.segundo_nombre),
            requiredText(input.primer_apellido),
            optionalText(input.segundo_apellido),
            toPgDate(input.fecha_nacimiento),
            input.sexo,
            optionalText(input.tipo_sangre),
            optionalText(input.telefono),
            optionalText(input.correo),
            optionalText(input.direccion),
            input.id_municipio ?? null,
            toPgTimestamptz(fecha),
          ],
        );
        pacienteRow = inserted.rows[0]!;
      } catch (error) {
        if (isDuplicateDocumentError(error)) {
          throw new ClinicalError('duplicate_document', DUPLICATE_DOCUMENT);
        }
        throw error;
      }

      this.afterWrite('afterPaciente');

      for (const responsable of responsables) {
        await postgresQuery(
          `INSERT INTO responsable (
             id_paciente, tipo_documento, numero_documento, nombre_completo,
             parentesco, telefono, correo, direccion, es_principal
           ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
          [
            pacienteRow.id_paciente,
            responsable.tipo_documento,
            responsable.numero_documento,
            responsable.nombre_completo,
            responsable.parentesco,
            responsable.telefono,
            optionalText(responsable.correo),
            optionalText(responsable.direccion),
            responsable.es_principal,
          ],
        );
      }

      const allocated = await postgresQuery<{ id_expediente: number }>(
        `SELECT nextval(pg_get_serial_sequence('expediente', 'id_expediente'))::int AS id_expediente`,
      );
      const id_expediente = allocated.rows[0]!.id_expediente;
      const numero_expediente = `EXP-${id_expediente}`;

      const expedienteInserted = await postgresQuery<ExpedienteRow>(
        `INSERT INTO expediente (
           id_expediente, id_paciente, numero_expediente, fecha_apertura,
           estado, fecha_archivo, motivo_archivo, observacion_archivo
         ) VALUES (
           $1, $2, $3, $4::timestamptz,
           'activo', NULL, NULL, NULL
         )
         RETURNING *`,
        [id_expediente, pacienteRow.id_paciente, numero_expediente, toPgTimestamptz(fecha)],
      );

      return {
        paciente: mapPaciente(pacienteRow),
        expediente: mapExpediente(expedienteInserted.rows[0]!),
      };
    });
  }

  async findById(id: PacienteId): Promise<PacienteDto | null> {
    const result = await postgresQuery<PacienteRow>(
      `SELECT * FROM paciente
        WHERE id_paciente = $1 AND id_institucion = $2`,
      [id, this.id_institucion],
    );
    const row = result.rows[0];
    return row ? mapPaciente(row) : null;
  }

  async findByDocumento(
    _tipo_documento: string,
    numero_documento: string,
  ): Promise<PacienteDto | null> {
    const result = await postgresQuery<PacienteRow>(
      `SELECT * FROM paciente
        WHERE id_institucion = $1 AND numero_documento = $2`,
      [this.id_institucion, normalizeDocumento(numero_documento)],
    );
    const row = result.rows[0];
    return row ? mapPaciente(row) : null;
  }

  async findExpedienteByPaciente(id: PacienteId): Promise<ExpedienteDto | null> {
    const result = await postgresQuery<ExpedienteRow>(
      `SELECT e.*
         FROM expediente e
         JOIN paciente p ON p.id_paciente = e.id_paciente
        WHERE e.id_paciente = $1 AND p.id_institucion = $2`,
      [id, this.id_institucion],
    );
    const row = result.rows[0];
    return row ? mapExpediente(row) : null;
  }

  async findExpedienteById(id: ExpedienteId): Promise<ExpedienteDto | null> {
    const result = await postgresQuery<ExpedienteRow>(
      `SELECT e.*
         FROM expediente e
         JOIN paciente p ON p.id_paciente = e.id_paciente
        WHERE e.id_expediente = $1 AND p.id_institucion = $2`,
      [id, this.id_institucion],
    );
    const row = result.rows[0];
    return row ? mapExpediente(row) : null;
  }

  async list(input: SearchPacientesInput): Promise<PacientePage> {
    const query = input.q.trim();
    const params: unknown[] = [this.id_institucion];
    const filters: string[] = ['p.id_institucion = $1'];

    if (input.estado !== 'todos') {
      params.push(input.estado);
      filters.push(`e.estado = $${params.length}`);
    }

    if (query.length > 0) {
      const normalized = normalizeDocumento(query);
      const like = `%${escapeLikeLiteral(query)}%`;
      params.push(normalized, query, like);
      const docIdx = params.length - 2;
      const expIdx = params.length - 1;
      const nameIdx = params.length;
      filters.push(`(
        p.numero_documento = $${docIdx}
        OR e.numero_expediente = $${expIdx}
        OR concat_ws(
             ' ',
             p.primer_nombre,
             NULLIF(p.segundo_nombre, ''),
             p.primer_apellido,
             NULLIF(p.segundo_apellido, '')
           ) ILIKE $${nameIdx} ESCAPE '\\'
      )`);
    }

    const where = filters.join(' AND ');
    const totalResult = await postgresQuery<{ n: number }>(
      `SELECT COUNT(*)::int AS n
         FROM paciente p
         JOIN expediente e ON e.id_paciente = p.id_paciente
        WHERE ${where}`,
      params,
    );
    const total = totalResult.rows[0]?.n ?? 0;

    const offset = (input.page - 1) * input.page_size;
    params.push(input.page_size, offset);
    const limitIdx = params.length - 1;
    const offsetIdx = params.length;

    interface SearchRow extends PacienteRow {
      id_expediente: number;
      numero_expediente: string;
      fecha_apertura: string | Date;
      expediente_estado: ExpedienteRow['estado'];
      fecha_archivo: string | Date | null;
      motivo_archivo: MotivoArchivo | null;
      observacion_archivo: string | null;
    }

    const pageResult = await postgresQuery<SearchRow>(
      `SELECT
         p.id_paciente, p.id_institucion, p.tipo_documento, p.numero_documento,
         p.primer_nombre, p.segundo_nombre, p.primer_apellido, p.segundo_apellido,
         p.fecha_nacimiento, p.sexo, p.tipo_sangre, p.telefono, p.correo, p.direccion,
         p.id_municipio, p.fecha_registro, p.estado,
         e.id_expediente, e.numero_expediente, e.fecha_apertura, e.estado AS expediente_estado,
         e.fecha_archivo, e.motivo_archivo, e.observacion_archivo
         FROM paciente p
         JOIN expediente e ON e.id_paciente = p.id_paciente
        WHERE ${where}
        ORDER BY p.id_paciente ASC
        LIMIT $${limitIdx} OFFSET $${offsetIdx}`,
      params,
    );

    const items: PacienteResumen[] = pageResult.rows.map((row) => ({
      paciente: mapPaciente(row),
      expediente: mapExpediente({
        id_expediente: row.id_expediente,
        id_paciente: row.id_paciente,
        numero_expediente: row.numero_expediente,
        fecha_apertura: row.fecha_apertura,
        estado: row.expediente_estado,
        fecha_archivo: row.fecha_archivo,
        motivo_archivo: row.motivo_archivo,
        observacion_archivo: row.observacion_archivo,
      }),
    }));

    return {
      items,
      page: input.page,
      page_size: input.page_size,
      total,
    };
  }

  async archiveExpediente(input: ArchiveExpedienteInput): Promise<ExpedienteDto> {
    return this.unitOfWork.runInTransaction(async () => {
      const locked = await postgresQuery<ExpedienteRow>(
        `SELECT e.*
           FROM expediente e
           JOIN paciente p ON p.id_paciente = e.id_paciente
          WHERE e.id_expediente = $1 AND p.id_institucion = $2
          FOR UPDATE OF e`,
        [input.id_expediente, this.id_institucion],
      );
      const current = locked.rows[0];
      if (!current) {
        throw new ClinicalError('not_found', NOT_FOUND);
      }
      if (current.estado === 'archivado') {
        throw new ClinicalError('already_archived', ALREADY_ARCHIVED);
      }

      const updated = await postgresQuery<ExpedienteRow>(
        `UPDATE expediente
            SET estado = $2,
                fecha_archivo = $3::timestamptz,
                motivo_archivo = $4,
                observacion_archivo = $5
          WHERE id_expediente = $1
          RETURNING *`,
        [
          input.id_expediente,
          archivedEstado(),
          toPgTimestamptz(input.fecha_archivo),
          input.motivo_archivo,
          input.observacion_archivo ?? null,
        ],
      );
      return mapExpediente(updated.rows[0]!);
    });
  }
}

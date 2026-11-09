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
  ReactivateExpedienteInput,
  ResponsableInput,
} from '@genki/shared';
import { asExpedienteId, asPacienteId } from '@genki/shared';
import type { ResultSetHeader, RowDataPacket } from 'mysql2';
import { ClinicalError } from '../../domain/clinical-error.js';
import { archivedEstado } from '../../domain/expediente-estado.js';
import type {
  CreatePacienteInput,
  PacienteRepositoryPort,
  PersistenceCheckpoint,
  SearchPacientesInput,
  UnitOfWorkPort,
} from '../../ports/index.js';
import { fromMysqlDate, fromMysqlDatetime, toMysqlDate, toMysqlDatetime } from './mapper.js';
import { mysqlQuery } from './unit-of-work.js';

const DUPLICATE_DOCUMENT = 'Documento ya registrado en esta institución';
const GUARDIAN_REQUIRED = 'Se requiere responsable principal';
const INVALID_GUARDIANS = 'Debe existir exactamente un responsable principal';
const ALREADY_ARCHIVED = 'El expediente ya está archivado';
const NOT_FOUND = 'Recurso no encontrado';
const CONFLICT = 'Conflicto de recurso';

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

function isMysqlErrno(error: unknown, errno: number): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'errno' in error &&
    (error as { errno: unknown }).errno === errno
  );
}

function mysqlConstraintName(error: unknown): string {
  if (typeof error !== 'object' || error === null) {
    return '';
  }
  const message =
    'sqlMessage' in error && typeof (error as { sqlMessage: unknown }).sqlMessage === 'string'
      ? (error as { sqlMessage: string }).sqlMessage
      : 'message' in error && typeof (error as { message: unknown }).message === 'string'
        ? (error as { message: string }).message
        : '';
  const match = /for key '([^']+)'/i.exec(message);
  if (!match?.[1]) {
    return '';
  }
  const full = match[1];
  const parts = full.split('.');
  return parts[parts.length - 1] ?? full;
}

function mapDuplicateError(error: unknown): never {
  if (isMysqlErrno(error, 1062)) {
    const constraint = mysqlConstraintName(error);
    if (constraint === 'uq_paciente_documento' || constraint.endsWith('uq_paciente_documento')) {
      throw new ClinicalError('duplicate_document', DUPLICATE_DOCUMENT);
    }
    if (
      constraint === 'uq_responsable_principal' ||
      constraint.endsWith('uq_responsable_principal')
    ) {
      throw new ClinicalError('invalid_guardians', INVALID_GUARDIANS);
    }
  }
  throw error;
}

function escapeLikeLiteral(value: string): string {
  return value.replaceAll('\\', '\\\\').replaceAll('%', '\\%').replaceAll('_', '\\_');
}

function pacienteFromRow(row: RowDataPacket): PacienteDto {
  return {
    id_paciente: asPacienteId(Number(row.id_paciente)),
    id_institucion: row.id_institucion as InstitutionId,
    tipo_documento: String(row.tipo_documento),
    numero_documento: String(row.numero_documento),
    primer_nombre: String(row.primer_nombre),
    segundo_nombre: row.segundo_nombre == null ? null : String(row.segundo_nombre),
    primer_apellido: String(row.primer_apellido),
    segundo_apellido: row.segundo_apellido == null ? null : String(row.segundo_apellido),
    fecha_nacimiento: fromMysqlDate(row.fecha_nacimiento),
    sexo: row.sexo as PacienteDto['sexo'],
    tipo_sangre: row.tipo_sangre == null ? null : String(row.tipo_sangre),
    telefono: row.telefono == null ? null : String(row.telefono),
    correo: row.correo == null ? null : String(row.correo),
    direccion: row.direccion == null ? null : String(row.direccion),
    id_municipio: row.id_municipio == null ? null : Number(row.id_municipio),
    fecha_registro: fromMysqlDatetime(row.fecha_registro),
    estado: row.estado as PacienteDto['estado'],
  };
}

function expedienteFromRow(row: RowDataPacket): ExpedienteDto {
  return {
    id_expediente: asExpedienteId(Number(row.id_expediente)),
    id_paciente: asPacienteId(Number(row.id_paciente)),
    numero_expediente: String(row.numero_expediente),
    fecha_apertura: fromMysqlDatetime(row.fecha_apertura),
    estado: row.estado as ExpedienteDto['estado'],
    fecha_archivo: row.fecha_archivo == null ? null : fromMysqlDatetime(row.fecha_archivo),
    motivo_archivo:
      row.motivo_archivo == null ? null : (row.motivo_archivo as ExpedienteDto['motivo_archivo']),
    observacion_archivo: row.observacion_archivo == null ? null : String(row.observacion_archivo),
  };
}

export class MysqlPacienteRepository implements PacienteRepositoryPort {
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

      let id_paciente: PacienteId;
      try {
        const [header] = await mysqlQuery<ResultSetHeader>(
          `INSERT INTO paciente (
             id_institucion, tipo_documento, numero_documento,
             primer_nombre, segundo_nombre, primer_apellido, segundo_apellido,
             fecha_nacimiento, sexo, tipo_sangre, telefono, correo, direccion,
             id_municipio, fecha_registro, estado
           ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'activo')`,
          [
            this.id_institucion,
            input.tipo_documento,
            numero,
            requiredText(input.primer_nombre),
            optionalText(input.segundo_nombre),
            requiredText(input.primer_apellido),
            optionalText(input.segundo_apellido),
            toMysqlDate(input.fecha_nacimiento),
            input.sexo,
            optionalText(input.tipo_sangre),
            optionalText(input.telefono),
            optionalText(input.correo),
            optionalText(input.direccion),
            input.id_municipio ?? null,
            toMysqlDatetime(fecha),
          ],
        );
        id_paciente = asPacienteId(Number(header.insertId));
      } catch (error) {
        mapDuplicateError(error);
      }

      this.afterWrite('afterPaciente');

      for (const responsable of responsables) {
        try {
          await mysqlQuery<ResultSetHeader>(
            `INSERT INTO responsable (
               id_paciente, tipo_documento, numero_documento, nombre_completo,
               parentesco, telefono, correo, direccion, es_principal
             ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              id_paciente,
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
        } catch (error) {
          mapDuplicateError(error);
        }
      }

      const [expHeader] = await mysqlQuery<ResultSetHeader>(
        `INSERT INTO expediente (
           id_paciente, numero_expediente, fecha_apertura, estado,
           fecha_archivo, motivo_archivo, observacion_archivo
         ) VALUES (?, ?, ?, 'activo', NULL, NULL, NULL)`,
        [id_paciente, `TMP-P-${id_paciente}`, toMysqlDatetime(fecha)],
      );
      const id_expediente = asExpedienteId(Number(expHeader.insertId));
      const numero_expediente = `EXP-${id_expediente}`;
      await mysqlQuery(`UPDATE expediente SET numero_expediente = ? WHERE id_expediente = ?`, [
        numero_expediente,
        id_expediente,
      ]);

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
      const expediente: ExpedienteDto = {
        id_expediente,
        id_paciente,
        numero_expediente,
        fecha_apertura: fecha,
        estado: 'activo',
        fecha_archivo: null,
        motivo_archivo: null,
        observacion_archivo: null,
      };
      return { paciente: cloneDto(paciente), expediente: cloneDto(expediente) };
    });
  }

  async findById(id: PacienteId): Promise<PacienteDto | null> {
    const [rows] = await mysqlQuery<RowDataPacket[]>(
      `SELECT * FROM paciente WHERE id_institucion = ? AND id_paciente = ?`,
      [this.id_institucion, id],
    );
    const row = rows[0];
    return row ? cloneDto(pacienteFromRow(row)) : null;
  }

  async findByDocumento(
    _tipo_documento: string,
    numero_documento: string,
  ): Promise<PacienteDto | null> {
    const [rows] = await mysqlQuery<RowDataPacket[]>(
      `SELECT * FROM paciente WHERE id_institucion = ? AND numero_documento = ?`,
      [this.id_institucion, normalizeDocumento(numero_documento)],
    );
    const row = rows[0];
    return row ? cloneDto(pacienteFromRow(row)) : null;
  }

  async findExpedienteByPaciente(id: PacienteId): Promise<ExpedienteDto | null> {
    const [rows] = await mysqlQuery<RowDataPacket[]>(
      `SELECT e.*
         FROM expediente e
         INNER JOIN paciente p ON p.id_paciente = e.id_paciente
        WHERE p.id_institucion = ? AND e.id_paciente = ?`,
      [this.id_institucion, id],
    );
    const row = rows[0];
    return row ? cloneDto(expedienteFromRow(row)) : null;
  }

  async findExpedienteById(id: ExpedienteId): Promise<ExpedienteDto | null> {
    const [rows] = await mysqlQuery<RowDataPacket[]>(
      `SELECT e.*
         FROM expediente e
         INNER JOIN paciente p ON p.id_paciente = e.id_paciente
        WHERE p.id_institucion = ? AND e.id_expediente = ?`,
      [this.id_institucion, id],
    );
    const row = rows[0];
    return row ? cloneDto(expedienteFromRow(row)) : null;
  }

  async list(input: SearchPacientesInput): Promise<PacientePage> {
    const query = input.q.trim();
    const estadoClause = input.estado === 'todos' ? '' : 'AND e.estado = ?';
    const params: unknown[] = [this.id_institucion];
    if (input.estado !== 'todos') {
      params.push(input.estado);
    }

    let whereMatch = '1=1';
    if (query.length > 0) {
      whereMatch = `(p.numero_documento = ?
           OR e.numero_expediente = ?
           OR LOWER(TRIM(CONCAT_WS(' ',
                NULLIF(TRIM(p.primer_nombre), ''),
                NULLIF(TRIM(p.segundo_nombre), ''),
                NULLIF(TRIM(p.primer_apellido), ''),
                NULLIF(TRIM(p.segundo_apellido), '')
              ))) LIKE LOWER(?) ESCAPE '\\\\')`;
      params.push(normalizeDocumento(query), query, `%${escapeLikeLiteral(query)}%`);
    }

    const countSql = `
      SELECT COUNT(*) AS total
        FROM paciente p
        INNER JOIN expediente e ON e.id_paciente = p.id_paciente
       WHERE p.id_institucion = ?
         ${estadoClause}
         AND ${whereMatch}`;
    const [countRows] = await mysqlQuery<RowDataPacket[]>(countSql, params);
    const total = Number(countRows[0]?.total ?? 0);

    const offset = (input.page - 1) * input.page_size;
    const listSql = `
      SELECT
        p.id_paciente, p.id_institucion, p.tipo_documento, p.numero_documento,
        p.primer_nombre, p.segundo_nombre, p.primer_apellido, p.segundo_apellido,
        p.fecha_nacimiento, p.sexo, p.tipo_sangre, p.telefono, p.correo, p.direccion,
        p.id_municipio, p.fecha_registro, p.estado AS paciente_estado,
        e.id_expediente, e.numero_expediente, e.fecha_apertura, e.estado AS expediente_estado,
        e.fecha_archivo, e.motivo_archivo, e.observacion_archivo
        FROM paciente p
        INNER JOIN expediente e ON e.id_paciente = p.id_paciente
       WHERE p.id_institucion = ?
         ${estadoClause}
         AND ${whereMatch}
       ORDER BY p.id_paciente ASC
       LIMIT ? OFFSET ?`;
    const [rows] = await mysqlQuery<RowDataPacket[]>(listSql, [...params, input.page_size, offset]);

    const items: PacienteResumen[] = rows.map((row) => {
      const paciente = pacienteFromRow({
        ...row,
        estado: row.paciente_estado,
      });
      const expediente = expedienteFromRow({
        ...row,
        id_paciente: row.id_paciente,
        estado: row.expediente_estado,
      });
      return { paciente: cloneDto(paciente), expediente: cloneDto(expediente) };
    });

    return {
      items,
      page: input.page,
      page_size: input.page_size,
      total,
    };
  }

  async archiveExpediente(input: ArchiveExpedienteInput): Promise<ExpedienteDto> {
    return this.unitOfWork.runInTransaction(async () => {
      const [rows] = await mysqlQuery<RowDataPacket[]>(
        `SELECT e.*
           FROM expediente e
           INNER JOIN paciente p ON p.id_paciente = e.id_paciente
          WHERE p.id_institucion = ? AND e.id_expediente = ?
          FOR UPDATE OF e`,
        [this.id_institucion, input.id_expediente],
      );
      const existing = rows[0];
      if (!existing) {
        throw new ClinicalError('not_found', NOT_FOUND);
      }
      if (String(existing.estado) === 'archivado') {
        throw new ClinicalError('already_archived', ALREADY_ARCHIVED);
      }

      await mysqlQuery(
        `UPDATE expediente
            SET estado = ?,
                fecha_archivo = ?,
                motivo_archivo = ?,
                observacion_archivo = ?
          WHERE id_expediente = ?`,
        [
          archivedEstado(),
          toMysqlDatetime(input.fecha_archivo),
          input.motivo_archivo,
          input.observacion_archivo ?? null,
          input.id_expediente,
        ],
      );

      const [updatedRows] = await mysqlQuery<RowDataPacket[]>(
        `SELECT e.*
           FROM expediente e
           INNER JOIN paciente p ON p.id_paciente = e.id_paciente
          WHERE p.id_institucion = ? AND e.id_expediente = ?`,
        [this.id_institucion, input.id_expediente],
      );
      const updated = updatedRows[0];
      if (!updated) {
        throw new ClinicalError('not_found', NOT_FOUND);
      }
      return cloneDto(expedienteFromRow(updated));
    });
  }

  async reactivateExpediente(input: ReactivateExpedienteInput): Promise<ExpedienteDto> {
    return this.unitOfWork.runInTransaction(async () => {
      const [rows] = await mysqlQuery<RowDataPacket[]>(
        `SELECT e.*
           FROM expediente e
           INNER JOIN paciente p ON p.id_paciente = e.id_paciente
          WHERE p.id_institucion = ? AND e.id_expediente = ?
          FOR UPDATE OF e`,
        [this.id_institucion, input.id_expediente],
      );
      const existing = rows[0];
      if (!existing) {
        throw new ClinicalError('not_found', NOT_FOUND);
      }
      if (String(existing.estado) !== 'archivado') {
        throw new ClinicalError('conflict', CONFLICT);
      }

      await mysqlQuery(
        `UPDATE expediente
            SET estado = 'activo',
                fecha_archivo = NULL,
                motivo_archivo = NULL,
                observacion_archivo = NULL
          WHERE id_expediente = ?`,
        [input.id_expediente],
      );

      const [updatedRows] = await mysqlQuery<RowDataPacket[]>(
        `SELECT e.*
           FROM expediente e
           INNER JOIN paciente p ON p.id_paciente = e.id_paciente
          WHERE p.id_institucion = ? AND e.id_expediente = ?`,
        [this.id_institucion, input.id_expediente],
      );
      const updated = updatedRows[0];
      if (!updated) {
        throw new ClinicalError('not_found', NOT_FOUND);
      }
      return cloneDto(expedienteFromRow(updated));
    });
  }
}

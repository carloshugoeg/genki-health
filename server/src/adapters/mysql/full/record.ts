import { asPacienteId, type InstitutionId } from '@genki/shared';
import type { FichaCompleta } from '@genki/shared/full/patient';
import type { ALERGIA, ANTECEDENTE } from '@genki/shared/full/record';
import { ClinicalError } from '../../../domain/clinical-error.js';
import type { ClockPort } from '../../../ports/clock.js';
import type { PacienteRepositoryPort } from '../../../ports/paciente-repository.js';
import type { UnitOfWorkPort } from '../../../ports/unit-of-work.js';
import type { OperationContext } from '../../../ports/full/context.js';
import type {
  Op12Request,
  Op12Response,
  Op15Request,
  Op15Response,
  Op16Request,
  Op16Response,
  Op18Request,
  Op18Response,
  Op19Request,
  Op19Response,
  RecordRepositoryPort,
} from '../../../ports/full/record.js';
import { fromMysqlDate, fromMysqlDatetime, toMysqlDate, toMysqlDatetime } from '../mapper.js';
import { mysqlQueryResult } from './query.js';

const NOT_FOUND = 'Recurso no encontrado';
const ARCHIVED = 'Expediente archivado';
const ALREADY_ARCHIVED = 'El expediente ya está archivado';
const CONFLICT = 'Conflicto de recurso';

function normalizeSustancia(value: string): string {
  return value.trim().toUpperCase();
}

export function createMysqlRecordRepository(deps: {
  id_institucion: InstitutionId;
  pacientes: PacienteRepositoryPort;
  unitOfWork: UnitOfWorkPort;
  clock: ClockPort;
}): RecordRepositoryPort {
  return {
    async op12(input: Op12Request): Promise<Op12Response> {
      return deps.unitOfWork.runInTransaction(async () => {
        const idPaciente = asPacienteId(input.params.id);
        const paciente = await deps.pacientes.findById(idPaciente);
        if (!paciente) throw new ClinicalError('not_found', NOT_FOUND);
        const expediente = await deps.pacientes.findExpedienteByPaciente(idPaciente);
        if (!expediente) throw new ClinicalError('not_found', NOT_FOUND);

        const antecedentes = await mysqlQueryResult<{
          id_antecedente: number;
          id_expediente: number;
          tipo: string;
          descripcion: string;
          fecha_inicio: string | Date | null;
          vigente: number | boolean;
          fecha_registro: string | Date;
        }>(
          `SELECT * FROM antecedente
            WHERE id_institucion = ? AND id_expediente = ?
            ORDER BY id_antecedente ASC`,
          [deps.id_institucion, expediente.id_expediente],
        );
        const alergias = await mysqlQueryResult<{
          id_alergia: number;
          id_expediente: number;
          sustancia: string;
          tipo: string;
          severidad: string;
          reaccion: string | null;
          fecha_deteccion: string | Date | null;
        }>(
          `SELECT * FROM alergia
            WHERE id_institucion = ? AND id_expediente = ?
            ORDER BY id_alergia ASC`,
          [deps.id_institucion, expediente.id_expediente],
        );

        const ficha: FichaCompleta = {
          paciente,
          expediente,
          antecedentes: antecedentes.rows.map((row): ANTECEDENTE => ({
            id_antecedente: row.id_antecedente,
            id_expediente: row.id_expediente,
            tipo: row.tipo,
            descripcion: row.descripcion,
            vigente: Boolean(row.vigente),
            fecha_registro: fromMysqlDatetime(row.fecha_registro),
            ...(row.fecha_inicio != null ? { fecha_inicio: fromMysqlDate(row.fecha_inicio) } : {}),
          })),
          alergias: alergias.rows.map((row): ALERGIA => ({
            id_alergia: row.id_alergia,
            id_expediente: row.id_expediente,
            sustancia: row.sustancia,
            tipo: row.tipo,
            severidad: row.severidad,
            ...(row.reaccion != null ? { reaccion: row.reaccion } : {}),
            ...(row.fecha_deteccion != null
              ? { fecha_deteccion: fromMysqlDate(row.fecha_deteccion) }
              : {}),
          })),
          contactos: [],
        };
        return ficha;
      });
    },

    async op15(input: Op15Request, context: OperationContext): Promise<Op15Response> {
      return deps.unitOfWork.runInTransaction(async () => {
        const idPaciente = asPacienteId(input.params.id);
        const expediente = await deps.pacientes.findExpedienteByPaciente(idPaciente);
        if (!expediente) throw new ClinicalError('not_found', NOT_FOUND);
        if (expediente.estado === 'archivado') {
          throw new ClinicalError('expediente_archived', ARCHIVED);
        }
        await mysqlQueryResult(
          `INSERT INTO antecedente (
             id_institucion, id_expediente, tipo, descripcion, fecha_inicio, vigente, fecha_registro
           ) VALUES (?,?,?,?,?,?,?)`,
          [
            deps.id_institucion,
            expediente.id_expediente,
            input.body.tipo,
            input.body.descripcion,
            input.body.fecha_inicio == null ? null : toMysqlDate(input.body.fecha_inicio),
            input.body.vigente,
            toMysqlDatetime(context.now || deps.clock.nowIso()),
          ],
        );
        const idRows = await mysqlQueryResult<{ id: number }>(`SELECT LAST_INSERT_ID() AS id`);
        const id_antecedente = Number(idRows.rows[0]?.id);
        const fetched = await mysqlQueryResult<{
          id_antecedente: number;
          id_expediente: number;
          tipo: string;
          descripcion: string;
          fecha_inicio: string | Date | null;
          vigente: number | boolean;
          fecha_registro: string | Date;
        }>(`SELECT * FROM antecedente WHERE id_antecedente = ?`, [id_antecedente]);
        const row = fetched.rows[0]!;
        return {
          id_antecedente: row.id_antecedente,
          id_expediente: row.id_expediente,
          tipo: row.tipo,
          descripcion: row.descripcion,
          vigente: Boolean(row.vigente),
          fecha_registro: fromMysqlDatetime(row.fecha_registro),
          ...(row.fecha_inicio != null ? { fecha_inicio: fromMysqlDate(row.fecha_inicio) } : {}),
        };
      });
    },

    async op16(input: Op16Request): Promise<Op16Response> {
      return deps.unitOfWork.runInTransaction(async () => {
        const idPaciente = asPacienteId(input.params.id);
        const expediente = await deps.pacientes.findExpedienteByPaciente(idPaciente);
        if (!expediente) throw new ClinicalError('not_found', NOT_FOUND);
        if (expediente.estado === 'archivado') {
          throw new ClinicalError('expediente_archived', ARCHIVED);
        }
        const norm = normalizeSustancia(input.body.sustancia);
        try {
          await mysqlQueryResult(
            `INSERT INTO alergia (
               id_institucion, id_expediente, sustancia, sustancia_norm, tipo, severidad,
               reaccion, fecha_deteccion
             ) VALUES (?,?,?,?,?,?,?,?)`,
            [
              deps.id_institucion,
              expediente.id_expediente,
              input.body.sustancia,
              norm,
              input.body.tipo,
              input.body.severidad,
              input.body.reaccion ?? null,
              input.body.fecha_deteccion == null ? null : toMysqlDate(input.body.fecha_deteccion),
            ],
          );
        } catch (err) {
          if (
            typeof err === 'object' &&
            err !== null &&
            'code' in err &&
            (err as { code: string }).code === 'ER_DUP_ENTRY'
          ) {
            throw new ClinicalError('conflict', CONFLICT);
          }
          throw err;
        }
        const idRows = await mysqlQueryResult<{ id: number }>(`SELECT LAST_INSERT_ID() AS id`);
        const id_alergia = Number(idRows.rows[0]?.id);
        const fetched = await mysqlQueryResult<{
          id_alergia: number;
          id_expediente: number;
          sustancia: string;
          tipo: string;
          severidad: string;
          reaccion: string | null;
          fecha_deteccion: string | Date | null;
        }>(`SELECT * FROM alergia WHERE id_alergia = ?`, [id_alergia]);
        const row = fetched.rows[0]!;
        return {
          id_alergia: row.id_alergia,
          id_expediente: row.id_expediente,
          sustancia: row.sustancia,
          tipo: row.tipo,
          severidad: row.severidad,
          ...(row.reaccion != null ? { reaccion: row.reaccion } : {}),
          ...(row.fecha_deteccion != null
            ? { fecha_deteccion: fromMysqlDate(row.fecha_deteccion) }
            : {}),
        };
      });
    },

    async op18(input: Op18Request, context: OperationContext): Promise<Op18Response> {
      return deps.unitOfWork.runInTransaction(async () => {
        const idPaciente = asPacienteId(input.params.id);
        const expediente = await deps.pacientes.findExpedienteByPaciente(idPaciente);
        if (!expediente) throw new ClinicalError('not_found', NOT_FOUND);
        if (expediente.estado === 'archivado') {
          throw new ClinicalError('already_archived', ALREADY_ARCHIVED);
        }
        const open = await mysqlQueryResult<{ n: number }>(
          `SELECT count(*) AS n FROM consulta
            WHERE id_expediente = ? AND estado = 'abierta'`,
          [expediente.id_expediente],
        );
        if (Number(open.rows[0]?.n ?? 0) > 0) {
          throw new ClinicalError('conflict', CONFLICT);
        }
        return deps.pacientes.archiveExpediente({
          id_expediente: expediente.id_expediente,
          motivo_archivo: input.body.motivo_archivo,
          fecha_archivo: context.now || deps.clock.nowIso(),
          ...(input.body.observacion_archivo !== undefined
            ? { observacion_archivo: input.body.observacion_archivo }
            : {}),
        });
      });
    },

    async op19(_input: Op19Request, _context: OperationContext): Promise<Op19Response> {
      throw new ClinicalError('misconfigured', 'OP19 belongs to a later record chunk');
    },
  };
}

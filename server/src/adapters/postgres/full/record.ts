import { asPacienteId, type ExpedienteDto, type InstitutionId } from '@genki/shared';
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
import { fromPgDate, fromPgTimestamptz, toPgTimestamptz } from '../mapper.js';
import { postgresQuery } from '../unit-of-work.js';

const NOT_FOUND = 'Recurso no encontrado';
const ARCHIVED = 'Expediente archivado';
const ALREADY_ARCHIVED = 'El expediente ya está archivado';
const CONFLICT = 'Conflicto de recurso';

function normalizeSustancia(value: string): string {
  return value.trim().toUpperCase();
}

export function createPostgresRecordRepository(deps: {
  id_institucion: InstitutionId;
  pacientes: PacienteRepositoryPort;
  unitOfWork: UnitOfWorkPort;
  clock: ClockPort;
}): RecordRepositoryPort {
  return {
    async op12(input: Op12Request, _context: OperationContext): Promise<Op12Response> {
      return deps.unitOfWork.runInTransaction(async () => {
        const idPaciente = asPacienteId(input.params.id);
        const paciente = await deps.pacientes.findById(idPaciente);
        if (!paciente) throw new ClinicalError('not_found', NOT_FOUND);
        const expediente = await deps.pacientes.findExpedienteByPaciente(idPaciente);
        if (!expediente) throw new ClinicalError('not_found', NOT_FOUND);

        const antecedentes = await postgresQuery<{
          id_antecedente: number;
          id_expediente: number;
          tipo: string;
          descripcion: string;
          fecha_inicio: string | Date | null;
          vigente: boolean;
          fecha_registro: string | Date;
        }>(
          `SELECT * FROM antecedente
            WHERE id_institucion = $1 AND id_expediente = $2
            ORDER BY id_antecedente ASC`,
          [deps.id_institucion, expediente.id_expediente],
        );
        const alergias = await postgresQuery<{
          id_alergia: number;
          id_expediente: number;
          sustancia: string;
          tipo: string;
          severidad: string;
          reaccion: string | null;
          fecha_deteccion: string | Date | null;
        }>(
          `SELECT * FROM alergia
            WHERE id_institucion = $1 AND id_expediente = $2
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
            vigente: row.vigente,
            fecha_registro: fromPgTimestamptz(row.fecha_registro),
            ...(row.fecha_inicio != null ? { fecha_inicio: fromPgDate(row.fecha_inicio) } : {}),
          })),
          alergias: alergias.rows.map((row): ALERGIA => ({
            id_alergia: row.id_alergia,
            id_expediente: row.id_expediente,
            sustancia: row.sustancia,
            tipo: row.tipo,
            severidad: row.severidad,
            ...(row.reaccion !== undefined ? { reaccion: row.reaccion } : {}),
            ...(row.fecha_deteccion != null
              ? { fecha_deteccion: fromPgDate(row.fecha_deteccion) }
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
        const inserted = await postgresQuery<{
          id_antecedente: number;
          id_expediente: number;
          tipo: string;
          descripcion: string;
          fecha_inicio: string | Date | null;
          vigente: boolean;
          fecha_registro: string | Date;
        }>(
          `INSERT INTO antecedente (
             id_institucion, id_expediente, tipo, descripcion, fecha_inicio, vigente, fecha_registro
           ) VALUES ($1,$2,$3,$4,$5::date,$6,$7::timestamptz)
           RETURNING *`,
          [
            deps.id_institucion,
            expediente.id_expediente,
            input.body.tipo,
            input.body.descripcion,
            input.body.fecha_inicio ?? null,
            input.body.vigente,
            toPgTimestamptz(context.now || deps.clock.nowIso()),
          ],
        );
        const row = inserted.rows[0]!;
        return {
          id_antecedente: row.id_antecedente,
          id_expediente: row.id_expediente,
          tipo: row.tipo,
          descripcion: row.descripcion,
          vigente: row.vigente,
          fecha_registro: fromPgTimestamptz(row.fecha_registro),
          ...(row.fecha_inicio != null ? { fecha_inicio: fromPgDate(row.fecha_inicio) } : {}),
        };
      });
    },

    async op16(input: Op16Request, _context: OperationContext): Promise<Op16Response> {
      return deps.unitOfWork.runInTransaction(async () => {
        const idPaciente = asPacienteId(input.params.id);
        const expediente = await deps.pacientes.findExpedienteByPaciente(idPaciente);
        if (!expediente) throw new ClinicalError('not_found', NOT_FOUND);
        if (expediente.estado === 'archivado') {
          throw new ClinicalError('expediente_archived', ARCHIVED);
        }
        const norm = normalizeSustancia(input.body.sustancia);
        try {
          const inserted = await postgresQuery<{
            id_alergia: number;
            id_expediente: number;
            sustancia: string;
            tipo: string;
            severidad: string;
            reaccion: string | null;
            fecha_deteccion: string | Date | null;
          }>(
            `INSERT INTO alergia (
               id_institucion, id_expediente, sustancia, sustancia_norm, tipo, severidad,
               reaccion, fecha_deteccion
             ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8::date)
             RETURNING *`,
            [
              deps.id_institucion,
              expediente.id_expediente,
              input.body.sustancia,
              norm,
              input.body.tipo,
              input.body.severidad,
              input.body.reaccion ?? null,
              input.body.fecha_deteccion ?? null,
            ],
          );
          const row = inserted.rows[0]!;
          return {
            id_alergia: row.id_alergia,
            id_expediente: row.id_expediente,
            sustancia: row.sustancia,
            tipo: row.tipo,
            severidad: row.severidad,
            ...(row.reaccion != null ? { reaccion: row.reaccion } : {}),
            ...(row.fecha_deteccion != null
              ? { fecha_deteccion: fromPgDate(row.fecha_deteccion) }
              : {}),
          };
        } catch (err) {
          if (
            typeof err === 'object' &&
            err !== null &&
            'code' in err &&
            (err as { code: string }).code === '23505'
          ) {
            throw new ClinicalError('conflict', CONFLICT);
          }
          throw err;
        }
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
        const open = await postgresQuery<{ n: string }>(
          `SELECT count(*)::text AS n FROM consulta
            WHERE id_expediente = $1 AND estado = 'abierta'`,
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

    async op19(input: Op19Request, context: OperationContext): Promise<Op19Response> {
      return deps.unitOfWork.runInTransaction(async () => {
        const idPaciente = asPacienteId(input.params.id);
        const expediente = await deps.pacientes.findExpedienteByPaciente(idPaciente);
        if (!expediente) throw new ClinicalError('not_found', NOT_FOUND);
        if (expediente.estado !== 'archivado') {
          throw new ClinicalError('conflict', CONFLICT);
        }
        await postgresQuery(
          `INSERT INTO reactivacion_audit (
             id_institucion, id_expediente, id_usuario, motivo, fecha_hora,
             fecha_archivo_previa, motivo_archivo_previo, observacion_archivo_previa
           ) VALUES ($1, $2, $3, $4, $5::timestamptz, $6::timestamptz, $7, $8)`,
          [
            deps.id_institucion,
            expediente.id_expediente,
            context.id_usuario,
            input.body.motivo,
            toPgTimestamptz(context.now || deps.clock.nowIso()),
            expediente.fecha_archivo ? toPgTimestamptz(expediente.fecha_archivo) : null,
            expediente.motivo_archivo,
            expediente.observacion_archivo,
          ],
        );
        return deps.pacientes.reactivateExpediente({ id_expediente: expediente.id_expediente });
      });
    },
  };
}

export type { ExpedienteDto };

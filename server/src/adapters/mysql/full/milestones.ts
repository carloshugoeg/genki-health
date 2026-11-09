import { asPacienteId, type InstitutionId } from '@genki/shared';
import type { SEGUIMIENTO_HITO } from '@genki/shared/full/milestones';
import { ClinicalError } from '../../../domain/clinical-error.js';
import type { ClockPort } from '../../../ports/clock.js';
import type { PacienteRepositoryPort } from '../../../ports/paciente-repository.js';
import type { UnitOfWorkPort } from '../../../ports/unit-of-work.js';
import type { OperationContext } from '../../../ports/full/context.js';
import type {
  MilestonesRepositoryPort,
  Op46Request,
  Op46Response,
} from '../../../ports/full/milestones.js';
import { fromMysqlBoolean, fromMysqlDate, toMysqlDate } from '../mapper.js';
import { mysqlQueryResult } from './query.js';

const NOT_FOUND = 'Recurso no encontrado';

export function createMysqlMilestonesRepository(deps: {
  id_institucion: InstitutionId;
  pacientes: PacienteRepositoryPort;
  unitOfWork: UnitOfWorkPort;
  clock: ClockPort;
}): MilestonesRepositoryPort {
  return {
    async op46(input: Op46Request, _context: OperationContext): Promise<Op46Response> {
      return deps.unitOfWork.runInTransaction(async () => {
        const expediente = await deps.pacientes.findExpedienteByPaciente(
          asPacienteId(input.params.id),
        );
        if (!expediente) throw new ClinicalError('not_found', NOT_FOUND);
        const hito = await mysqlQueryResult<{ id_hito: number }>(
          `SELECT id_hito FROM hito_desarrollo WHERE id_institucion = ? AND id_hito = ?`,
          [deps.id_institucion, input.params.hito],
        );
        if (!hito.rows[0]) throw new ClinicalError('not_found', NOT_FOUND);

        await mysqlQueryResult(
          `INSERT INTO seguimiento_hito (
             id_institucion, id_expediente, id_hito, alcanzado, fecha_evaluacion, observacion
           ) VALUES (?,?,?,?,?,?)
           ON DUPLICATE KEY UPDATE
             alcanzado=VALUES(alcanzado),
             fecha_evaluacion=VALUES(fecha_evaluacion),
             observacion=VALUES(observacion)`,
          [
            deps.id_institucion,
            expediente.id_expediente,
            input.params.hito,
            input.body.alcanzado,
            toMysqlDate(input.body.fecha_evaluacion),
            input.body.observacion ?? null,
          ],
        );
        const refreshed = await mysqlQueryResult<{
          id_expediente: number;
          id_hito: number;
          alcanzado: number | boolean;
          fecha_evaluacion: string | Date;
          observacion: string | null;
        }>(
          `SELECT * FROM seguimiento_hito
            WHERE id_institucion = ? AND id_expediente = ? AND id_hito = ?`,
          [deps.id_institucion, expediente.id_expediente, input.params.hito],
        );
        const row = refreshed.rows[0]!;
        const out: SEGUIMIENTO_HITO = {
          id_expediente: row.id_expediente,
          id_hito: row.id_hito,
          alcanzado: fromMysqlBoolean(row.alcanzado),
          fecha_evaluacion: fromMysqlDate(row.fecha_evaluacion),
          ...(row.observacion != null ? { observacion: row.observacion } : {}),
        };
        void deps.clock;
        return out;
      });
    },
  };
}

import type { InstitutionId } from '@genki/shared';
import type { ADMISION } from '@genki/shared/full/schema';
import { ClinicalError } from '../../../domain/clinical-error.js';
import type { ClockPort } from '../../../ports/clock.js';
import type { UnitOfWorkPort } from '../../../ports/unit-of-work.js';
import type { OperationContext } from '../../../ports/full/context.js';
import type {
  DischargeRepositoryPort,
  Op38Request,
  Op38Response,
} from '../../../ports/full/discharge.js';
import { fromPgTimestamptz, toPgTimestamptz } from '../mapper.js';
import { postgresQuery } from '../unit-of-work.js';

const NOT_FOUND = 'Recurso no encontrado';
const CONFLICT = 'Conflicto de recurso';

export function createPostgresDischargeRepository(deps: {
  id_institucion: InstitutionId;
  unitOfWork: UnitOfWorkPort;
  clock: ClockPort;
}): DischargeRepositoryPort {
  return {
    async op38(input: Op38Request, _context: OperationContext): Promise<Op38Response> {
      return deps.unitOfWork.runInTransaction(async () => {
        const adm = await postgresQuery<{
          id_admision: number;
          id_expediente: number;
          id_consulta_origen: number | null;
          id_cama: number;
          tipo_ingreso: string;
          fecha_hora_ingreso: string | Date;
          id_diagnostico_ingreso: number;
          estado: string;
        }>(`SELECT * FROM admision WHERE id_admision = $1 FOR UPDATE`, [input.params.id]);
        const row = adm.rows[0];
        if (!row) throw new ClinicalError('not_found', NOT_FOUND);
        if (row.estado !== 'activa') throw new ClinicalError('conflict', CONFLICT);
        const ingreso = fromPgTimestamptz(row.fecha_hora_ingreso);
        if (input.body.fecha_hora_egreso <= ingreso) throw new ClinicalError('conflict', CONFLICT);

        const dx = await postgresQuery<{ id_diagnostico: number }>(
          `SELECT id_diagnostico FROM diagnostico WHERE id_diagnostico = $1`,
          [input.body.id_diagnostico_egreso],
        );
        if (!dx.rows[0]) throw new ClinicalError('not_found', NOT_FOUND);

        const updated = await postgresQuery<{
          id_admision: number;
          id_expediente: number;
          id_consulta_origen: number | null;
          id_cama: number;
          tipo_ingreso: string;
          fecha_hora_ingreso: string | Date;
          fecha_hora_egreso: string | Date | null;
          id_diagnostico_ingreso: number;
          id_diagnostico_egreso: number | null;
          condicion_egreso: string | null;
          estado: string;
        }>(
          `UPDATE admision SET
             estado = 'cerrada',
             fecha_hora_egreso = $2::timestamptz,
             id_diagnostico_egreso = $3,
             condicion_egreso = $4
           WHERE id_admision = $1
           RETURNING *`,
          [
            row.id_admision,
            toPgTimestamptz(input.body.fecha_hora_egreso),
            input.body.id_diagnostico_egreso,
            input.body.condicion_egreso,
          ],
        );
        await postgresQuery(`UPDATE cama SET estado = 'libre' WHERE id_cama = $1`, [row.id_cama]);
        const u = updated.rows[0]!;
        const out: ADMISION = {
          id_admision: u.id_admision,
          id_expediente: u.id_expediente,
          id_cama: u.id_cama,
          tipo_ingreso: u.tipo_ingreso,
          fecha_hora_ingreso: fromPgTimestamptz(u.fecha_hora_ingreso),
          id_diagnostico_ingreso: u.id_diagnostico_ingreso,
          estado: u.estado,
          fecha_hora_egreso: fromPgTimestamptz(u.fecha_hora_egreso!),
          id_diagnostico_egreso: u.id_diagnostico_egreso!,
          condicion_egreso: u.condicion_egreso!,
          ...(u.id_consulta_origen != null ? { id_consulta_origen: u.id_consulta_origen } : {}),
        };
        void deps.clock;
        return out;
      });
    },
  };
}

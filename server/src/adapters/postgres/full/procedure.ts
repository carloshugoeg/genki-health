import type { InstitutionId } from '@genki/shared';
import type { NOTA_EVOLUCION } from '@genki/shared/full/schema';
import { ClinicalError } from '../../../domain/clinical-error.js';
import type { ClockPort } from '../../../ports/clock.js';
import type { UnitOfWorkPort } from '../../../ports/unit-of-work.js';
import type { OperationContext } from '../../../ports/full/context.js';
import type {
  Op36Request,
  Op36Response,
  Op37Request,
  Op37Response,
  ProcedureRepositoryPort,
} from '../../../ports/full/procedure.js';
import { fromPgTimestamptz, toPgTimestamptz } from '../mapper.js';
import { postgresQuery } from '../unit-of-work.js';

const NOT_FOUND = 'Recurso no encontrado';
const CONFLICT = 'Conflicto de recurso';

export function createPostgresProcedureRepository(deps: {
  id_institucion: InstitutionId;
  unitOfWork: UnitOfWorkPort;
  clock: ClockPort;
}): ProcedureRepositoryPort {
  return {
    async op36(input: Op36Request, context: OperationContext): Promise<Op36Response> {
      return deps.unitOfWork.runInTransaction(async () => {
        const adm = await postgresQuery<{ id_admision: number; estado: string }>(
          `SELECT id_admision, estado FROM admision WHERE id_admision = $1 FOR UPDATE`,
          [input.params.id],
        );
        const row = adm.rows[0];
        if (!row) throw new ClinicalError('not_found', NOT_FOUND);
        if (row.estado !== 'activa') throw new ClinicalError('conflict', CONFLICT);
        const id_profesional = context.id_profesional;
        if (!id_profesional) throw new ClinicalError('forbidden', 'No autorizado');

        if (input.body.id_nota_anterior) {
          const prev = await postgresQuery<{ id_nota: number; id_admision: number }>(
            `SELECT id_nota, id_admision FROM nota_evolucion WHERE id_nota = $1`,
            [input.body.id_nota_anterior],
          );
          if (!prev.rows[0] || prev.rows[0].id_admision !== row.id_admision) {
            throw new ClinicalError('conflict', CONFLICT);
          }
        }

        const inserted = await postgresQuery<{
          id_nota: number;
          id_admision: number;
          id_profesional: number;
          fecha_hora: string | Date;
          contenido: string;
          turno: string | null;
          id_nota_anterior: number | null;
        }>(
          `INSERT INTO nota_evolucion (
             id_admision, id_profesional, id_nota_anterior, fecha_hora, contenido, turno
           ) VALUES ($1,$2,$3,$4::timestamptz,$5,$6)
           RETURNING *`,
          [
            row.id_admision,
            id_profesional,
            input.body.id_nota_anterior ?? null,
            toPgTimestamptz(context.now || deps.clock.nowIso()),
            input.body.contenido,
            input.body.turno ?? null,
          ],
        );
        const n = inserted.rows[0]!;
        const out: NOTA_EVOLUCION = {
          id_nota: n.id_nota,
          id_admision: n.id_admision,
          id_profesional: n.id_profesional,
          fecha_hora: fromPgTimestamptz(n.fecha_hora),
          contenido: n.contenido,
          ...(n.turno != null ? { turno: n.turno } : {}),
          ...(n.id_nota_anterior != null ? { id_nota_anterior: n.id_nota_anterior } : {}),
        };
        return out;
      });
    },

    async op37(_input: Op37Request, _context: OperationContext): Promise<Op37Response> {
      throw new ClinicalError('misconfigured', 'OP37 diferido (cargos/insumos)');
    },
  };
}

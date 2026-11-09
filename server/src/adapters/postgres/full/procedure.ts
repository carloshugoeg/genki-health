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

    async op37(input: Op37Request, context: OperationContext): Promise<Op37Response> {
      return deps.unitOfWork.runInTransaction(async () => {
        const catalog = await postgresQuery<{ codigo_procedimiento: string }>(
          `SELECT codigo_procedimiento FROM catalogo_procedimiento WHERE codigo_procedimiento = $1`,
          [input.body.codigo_procedimiento],
        );
        if (!catalog.rows[0]) {
          throw new ClinicalError('reference_not_found', 'Referencia no encontrada');
        }

        if (input.body.id_admision != null) {
          const adm = await postgresQuery<{ id_admision: number; estado: string }>(
            `SELECT id_admision, estado FROM admision WHERE id_admision = $1 FOR UPDATE`,
            [input.body.id_admision],
          );
          if (!adm.rows[0]) throw new ClinicalError('reference_not_found', 'Referencia no encontrada');
          if (adm.rows[0].estado !== 'activa') throw new ClinicalError('conflict', CONFLICT);
        }
        if (input.body.id_consulta != null) {
          const cons = await postgresQuery<{ id_consulta: number }>(
            `SELECT id_consulta FROM consulta WHERE id_consulta = $1`,
            [input.body.id_consulta],
          );
          if (!cons.rows[0]) throw new ClinicalError('reference_not_found', 'Referencia no encontrada');
        }

        const inserted = await postgresQuery<{
          id_procedimiento: number;
          id_admision: number | null;
          id_consulta: number | null;
          codigo_procedimiento: string;
          id_profesional: number;
          fecha_hora: string | Date;
          sala: string | null;
          hallazgos: string | null;
          complicaciones: string | null;
        }>(
          `INSERT INTO procedimiento (
             id_admision, id_consulta, codigo_procedimiento, id_profesional,
             fecha_hora, sala, hallazgos, complicaciones, equipo, consumos
           ) VALUES ($1,$2,$3,$4,$5::timestamptz,$6,$7,$8,$9::jsonb,$10::jsonb)
           RETURNING id_procedimiento, id_admision, id_consulta, codigo_procedimiento,
             id_profesional, fecha_hora, sala, hallazgos, complicaciones`,
          [
            input.body.id_admision ?? null,
            input.body.id_consulta ?? null,
            input.body.codigo_procedimiento,
            input.body.id_profesional,
            toPgTimestamptz(input.body.fecha_hora || context.now || deps.clock.nowIso()),
            input.body.sala ?? null,
            input.body.hallazgos ?? null,
            input.body.complicaciones ?? null,
            JSON.stringify(input.body.equipo),
            JSON.stringify(input.body.consumos),
          ],
        );
        const row = inserted.rows[0]!;
        return {
          id_procedimiento: row.id_procedimiento,
          codigo_procedimiento: row.codigo_procedimiento,
          id_profesional: row.id_profesional,
          fecha_hora: fromPgTimestamptz(row.fecha_hora),
          ...(row.id_admision != null ? { id_admision: row.id_admision } : {}),
          ...(row.id_consulta != null ? { id_consulta: row.id_consulta } : {}),
          ...(row.sala != null ? { sala: row.sala } : {}),
          ...(row.hallazgos != null ? { hallazgos: row.hallazgos } : {}),
          ...(row.complicaciones != null ? { complicaciones: row.complicaciones } : {}),
        };
      });
    },
  };
}

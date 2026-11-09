import { asPacienteId, type InstitutionId } from '@genki/shared';
import type {
  ANTECEDENTE_PERINATAL,
  MEDICION_ANTROPOMETRICA,
} from '@genki/shared/full/growth';
import { ClinicalError } from '../../../domain/clinical-error.js';
import type { ClockPort } from '../../../ports/clock.js';
import type { PacienteRepositoryPort } from '../../../ports/paciente-repository.js';
import type { UnitOfWorkPort } from '../../../ports/unit-of-work.js';
import type { OperationContext } from '../../../ports/full/context.js';
import type {
  GrowthRepositoryPort,
  Op40Request,
  Op40Response,
  Op41Request,
  Op41Response,
  Op42Request,
  Op42Response,
} from '../../../ports/full/growth.js';
import { fromMysqlDate, fromMysqlDecimal, toMysqlDate } from '../mapper.js';
import { mysqlQueryResult } from './query.js';

const NOT_FOUND = 'Recurso no encontrado';

export function createMysqlGrowthRepository(deps: {
  id_institucion: InstitutionId;
  pacientes: PacienteRepositoryPort;
  unitOfWork: UnitOfWorkPort;
  clock: ClockPort;
}): GrowthRepositoryPort {
  return {
    async op40(input: Op40Request, _context: OperationContext): Promise<Op40Response> {
      return deps.unitOfWork.runInTransaction(async () => {
        const expediente = await deps.pacientes.findExpedienteByPaciente(
          asPacienteId(input.params.id),
        );
        if (!expediente) throw new ClinicalError('not_found', NOT_FOUND);
        await mysqlQueryResult(
          `INSERT INTO antecedente_perinatal (
             id_institucion, id_expediente, semanas_gestacion, tipo_parto, peso_nacimiento_g,
             talla_nacimiento_cm, apgar_1min, apgar_5min, complicaciones
           ) VALUES (?,?,?,?,?,?,?,?,?)
           ON DUPLICATE KEY UPDATE
             semanas_gestacion=VALUES(semanas_gestacion),
             tipo_parto=VALUES(tipo_parto),
             peso_nacimiento_g=VALUES(peso_nacimiento_g),
             talla_nacimiento_cm=VALUES(talla_nacimiento_cm),
             apgar_1min=VALUES(apgar_1min),
             apgar_5min=VALUES(apgar_5min),
             complicaciones=VALUES(complicaciones)`,
          [
            deps.id_institucion,
            expediente.id_expediente,
            input.body.semanas_gestacion ?? null,
            input.body.tipo_parto ?? null,
            input.body.peso_nacimiento_g ?? null,
            input.body.talla_nacimiento_cm ?? null,
            input.body.apgar_1min ?? null,
            input.body.apgar_5min ?? null,
            input.body.complicaciones ?? null,
          ],
        );
        const row: ANTECEDENTE_PERINATAL = {
          id_expediente: expediente.id_expediente,
          ...input.body,
        };
        return row;
      });
    },

    async op41(input: Op41Request, _context: OperationContext): Promise<Op41Response> {
      return deps.unitOfWork.runInTransaction(async () => {
        const found = await mysqlQueryResult<{ id_consulta: number; id_expediente: number }>(
          `SELECT id_consulta, id_expediente FROM consulta
            WHERE id_institucion = ? AND id_consulta = ?`,
          [deps.id_institucion, input.params.id],
        );
        const consulta = found.rows[0];
        if (!consulta) throw new ClinicalError('not_found', NOT_FOUND);

        await mysqlQueryResult(
          `INSERT INTO medicion_antropometrica (
             id_institucion, id_consulta, fecha_medicion, edad_meses, peso_kg, talla_cm,
             perimetro_cefalico_cm, version_referencia
           ) VALUES (?,?,?,?,?,?,?,?)`,
          [
            deps.id_institucion,
            consulta.id_consulta,
            toMysqlDate(input.body.fecha_medicion),
            0,
            input.body.peso_kg,
            input.body.talla_cm,
            input.body.perimetro_cefalico_cm ?? null,
            'none',
          ],
        );
        const idRows = await mysqlQueryResult<{ id: number }>(`SELECT LAST_INSERT_ID() AS id`);
        const id_medicion = Number(idRows.rows[0]?.id);
        const out: MEDICION_ANTROPOMETRICA = {
          id_medicion,
          id_consulta: consulta.id_consulta,
          fecha_medicion: input.body.fecha_medicion,
          edad_meses: 0,
          peso_kg: input.body.peso_kg,
          talla_cm: input.body.talla_cm,
          version_referencia: 'none',
          ...(input.body.perimetro_cefalico_cm !== undefined
            ? { perimetro_cefalico_cm: input.body.perimetro_cefalico_cm }
            : {}),
        };
        void deps.clock;
        return out;
      });
    },

    async op42(input: Op42Request, _context: OperationContext): Promise<Op42Response> {
      return deps.unitOfWork.runInTransaction(async () => {
        const expediente = await deps.pacientes.findExpedienteByPaciente(
          asPacienteId(input.params.id),
        );
        if (!expediente) throw new ClinicalError('not_found', NOT_FOUND);
        const result = await mysqlQueryResult<{
          id_medicion: number;
          id_consulta: number;
          fecha_medicion: string | Date | null;
          edad_meses: number;
          peso_kg: string | number;
          talla_cm: string | number;
          perimetro_cefalico_cm: string | number | null;
          version_referencia: string;
        }>(
          `SELECT m.* FROM medicion_antropometrica m
             INNER JOIN consulta c
               ON c.id_institucion = m.id_institucion AND c.id_consulta = m.id_consulta
            WHERE m.id_institucion = ? AND c.id_expediente = ?
            ORDER BY m.id_medicion ASC`,
          [deps.id_institucion, expediente.id_expediente],
        );
        return result.rows.map((row): MEDICION_ANTROPOMETRICA => ({
          id_medicion: Number(row.id_medicion),
          id_consulta: Number(row.id_consulta),
          edad_meses: Number(row.edad_meses),
          peso_kg: fromMysqlDecimal(row.peso_kg),
          talla_cm: fromMysqlDecimal(row.talla_cm),
          version_referencia: row.version_referencia,
          ...(row.fecha_medicion != null
            ? { fecha_medicion: fromMysqlDate(row.fecha_medicion) }
            : {}),
          ...(row.perimetro_cefalico_cm != null
            ? { perimetro_cefalico_cm: fromMysqlDecimal(row.perimetro_cefalico_cm) }
            : {}),
        }));
      });
    },
  };
}

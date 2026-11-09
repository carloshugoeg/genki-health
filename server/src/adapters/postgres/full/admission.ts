import { asPacienteId, type InstitutionId } from '@genki/shared';
import type { ADMISION, CAMA } from '@genki/shared/full/admission';
import { ClinicalError } from '../../../domain/clinical-error.js';
import type { ClockPort } from '../../../ports/clock.js';
import type { PacienteRepositoryPort } from '../../../ports/paciente-repository.js';
import type { UnitOfWorkPort } from '../../../ports/unit-of-work.js';
import type { OperationContext } from '../../../ports/full/context.js';
import type {
  AdmissionRepositoryPort,
  Op34Request,
  Op34Response,
  Op35Request,
  Op35Response,
} from '../../../ports/full/admission.js';
import { fromPgTimestamptz, toPgTimestamptz } from '../mapper.js';
import { postgresQuery } from '../unit-of-work.js';

const NOT_FOUND = 'Recurso no encontrado';
const CONFLICT = 'Conflicto de recurso';

export function createPostgresAdmissionRepository(deps: {
  id_institucion: InstitutionId;
  pacientes: PacienteRepositoryPort;
  unitOfWork: UnitOfWorkPort;
  clock: ClockPort;
}): AdmissionRepositoryPort {
  return {
    async op34(input: Op34Request, _context: OperationContext): Promise<Op34Response> {
      return deps.unitOfWork.runInTransaction(async () => {
        const params: unknown[] = [];
        let sql = `SELECT id_cama, id_servicio, codigo, tipo_cama, codigo_servicio, estado
                     FROM cama WHERE estado = 'libre'`;
        if (input.query.id_servicio !== undefined) {
          params.push(input.query.id_servicio);
          sql += ` AND id_servicio = $${params.length}`;
        }
        sql += ' ORDER BY id_servicio ASC, id_cama ASC';
        const result = await postgresQuery<CAMA>(sql, params);
        return result.rows.map((row) => ({ ...row }));
      });
    },

    async op35(input: Op35Request, context: OperationContext): Promise<Op35Response> {
      return deps.unitOfWork.runInTransaction(async () => {
        const paciente = await deps.pacientes.findById(asPacienteId(input.params.id));
        if (!paciente) throw new ClinicalError('not_found', NOT_FOUND);
        const expediente = await deps.pacientes.findExpedienteByPaciente(asPacienteId(input.params.id));
        if (!expediente) throw new ClinicalError('not_found', NOT_FOUND);
        if (expediente.estado === 'archivado') {
          throw new ClinicalError('expediente_archived', 'Expediente archivado');
        }

        const bedLock = await postgresQuery<{
          id_cama: number;
          estado: string;
        }>(`SELECT id_cama, estado FROM cama WHERE id_cama = $1 FOR UPDATE`, [input.body.id_cama]);
        const bed = bedLock.rows[0];
        if (!bed || bed.estado !== 'libre') throw new ClinicalError('conflict', CONFLICT);

        const active = await postgresQuery<{ id_admision: number }>(
          `SELECT id_admision FROM admision
            WHERE estado = 'activa' AND (id_expediente = $1 OR id_cama = $2)
            FOR UPDATE`,
          [expediente.id_expediente, bed.id_cama],
        );
        if (active.rows.length > 0) throw new ClinicalError('conflict', CONFLICT);

        const dx = await postgresQuery<{ id_diagnostico: number }>(
          `SELECT id_diagnostico FROM diagnostico WHERE id_diagnostico = $1`,
          [input.body.id_diagnostico_ingreso],
        );
        if (!dx.rows[0]) throw new ClinicalError('not_found', NOT_FOUND);

        const inserted = await postgresQuery<{
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
          `INSERT INTO admision (
             id_expediente, id_consulta_origen, id_cama, id_diagnostico_ingreso,
             tipo_ingreso, fecha_hora_ingreso, estado
           ) VALUES ($1,$2,$3,$4,$5,$6::timestamptz,'activa')
           RETURNING *`,
          [
            expediente.id_expediente,
            input.body.id_consulta_origen ?? null,
            bed.id_cama,
            input.body.id_diagnostico_ingreso,
            input.body.tipo_ingreso,
            toPgTimestamptz(input.body.fecha_hora_ingreso),
          ],
        );
        await postgresQuery(`UPDATE cama SET estado = 'ocupada' WHERE id_cama = $1`, [bed.id_cama]);
        const row = inserted.rows[0]!;
        const out: ADMISION = {
          id_admision: row.id_admision,
          id_expediente: row.id_expediente,
          id_cama: row.id_cama,
          tipo_ingreso: row.tipo_ingreso,
          fecha_hora_ingreso: fromPgTimestamptz(row.fecha_hora_ingreso),
          id_diagnostico_ingreso: row.id_diagnostico_ingreso,
          estado: row.estado,
          ...(row.id_consulta_origen != null ? { id_consulta_origen: row.id_consulta_origen } : {}),
        };
        void context;
        return out;
      });
    },
  };
}

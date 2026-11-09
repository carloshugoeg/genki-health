import {
  asConsultaId,
  asPacienteId,
  type ConsultaDto,
  type ExpedienteId,
  type InstitutionId,
  type ProfesionalId,
} from '@genki/shared';
import type { ConsultaDraft, SIGNOS_VITALES } from '@genki/shared/full/consultation';
import { ClinicalError } from '../../../domain/clinical-error.js';
import type { ClockPort } from '../../../ports/clock.js';
import type { PacienteRepositoryPort } from '../../../ports/paciente-repository.js';
import type { UnitOfWorkPort } from '../../../ports/unit-of-work.js';
import type { OperationContext } from '../../../ports/full/context.js';
import type {
  ConsultationRepositoryPort,
  Op26Request,
  Op26Response,
  Op27Request,
  Op27Response,
} from '../../../ports/full/consultation.js';
import { fromPgNumeric, fromPgTimestamptz, toPgTimestamptz } from '../mapper.js';
import { postgresQuery } from '../unit-of-work.js';
import { createPostgresClinicalMaintenance } from './clinical-maintenance.js';

const NOT_FOUND = 'Recurso no encontrado';
const ARCHIVED = 'Expediente archivado';
const CONFLICT = 'Conflicto de recurso';
const LATER = 'OP belongs to a later consultation chunk';

export function createPostgresConsultationRepository(deps: {
  id_institucion: InstitutionId;
  pacientes: PacienteRepositoryPort;
  unitOfWork: UnitOfWorkPort;
  clock: ClockPort;
}): ConsultationRepositoryPort {
  const unsupported = async (): Promise<never> => {
    throw new ClinicalError('misconfigured', LATER);
  };

  return {
    async op26(input: Op26Request, _context: OperationContext): Promise<Op26Response> {
      return deps.unitOfWork.runInTransaction(async () => {
        const idPaciente = asPacienteId(input.params.id);
        const expediente = await deps.pacientes.findExpedienteByPaciente(idPaciente);
        if (!expediente) throw new ClinicalError('not_found', NOT_FOUND);
        if (expediente.estado === 'archivado') {
          throw new ClinicalError('expediente_archived', ARCHIVED);
        }
        if (input.body.id_cita != null) {
          throw new ClinicalError('invalid_body', 'Solicitud inválida');
        }
        const open = await postgresQuery<{ n: string }>(
          `SELECT count(*)::text AS n FROM consulta
            WHERE id_expediente = $1 AND estado = 'abierta'`,
          [expediente.id_expediente],
        );
        if (Number(open.rows[0]?.n ?? 0) > 0) {
          throw new ClinicalError('conflict', CONFLICT);
        }
        const pro = await postgresQuery<{ id_profesional: number }>(
          `SELECT id_profesional FROM profesional
            WHERE id_profesional = $1 AND id_institucion = $2 AND activo = TRUE`,
          [input.body.id_profesional, deps.id_institucion],
        );
        if (!pro.rows[0]) throw new ClinicalError('reference_not_found', NOT_FOUND);

        const inserted = await postgresQuery<{
          id_consulta: number;
          id_expediente: number;
          id_profesional: number;
          id_cita: number | null;
          fecha_hora_inicio: string | Date;
          fecha_hora_fin: string | Date | null;
          tipo: string;
          motivo_consulta: string;
          enfermedad_actual: string | null;
          exploracion_fisica: string | null;
          plan: string | null;
          estado: string;
        }>(
          `INSERT INTO consulta (
             id_expediente, id_profesional, id_cita, fecha_hora_inicio, fecha_hora_fin,
             tipo, motivo_consulta, enfermedad_actual, exploracion_fisica, plan, estado
           ) VALUES ($1,$2,NULL,$3::timestamptz,NULL,$4,$5,NULL,NULL,NULL,'abierta')
           RETURNING *`,
          [
            expediente.id_expediente,
            input.body.id_profesional,
            toPgTimestamptz(input.body.fecha_hora_inicio),
            input.body.tipo,
            input.body.motivo_consulta,
          ],
        );
        const row = inserted.rows[0]!;
        await postgresQuery(
          `INSERT INTO consulta_borrador (id_institucion, id_consulta, bundle, revision)
           VALUES ($1,$2,$3::jsonb,1)`,
          [
            deps.id_institucion,
            row.id_consulta,
            JSON.stringify({ diagnosticos: [], tratamientos: [], receta: null }),
          ],
        );

        const consulta: ConsultaDto = {
          id_consulta: asConsultaId(row.id_consulta),
          id_expediente: row.id_expediente as ExpedienteId,
          id_profesional: row.id_profesional as ProfesionalId,
          id_cita: null,
          fecha_hora_inicio: fromPgTimestamptz(row.fecha_hora_inicio),
          fecha_hora_fin: null,
          tipo: row.tipo,
          motivo_consulta: row.motivo_consulta,
          enfermedad_actual: null,
          exploracion_fisica: null,
          plan: null,
          estado: 'abierta',
        };
        const draft: ConsultaDraft = {
          consulta: {
            ...consulta,
            estado: 'abierta',
            tipo: row.tipo as ConsultaDraft['consulta']['tipo'],
          },
          revision: 1,
          diagnosticos: [],
          tratamientos: [],
          receta: null,
        };
        return draft;
      });
    },

    async op27(input: Op27Request, context: OperationContext): Promise<Op27Response> {
      return deps.unitOfWork.runInTransaction(async () => {
        const found = await postgresQuery<{ id_consulta: number; estado: string }>(
          `SELECT c.id_consulta, c.estado
             FROM consulta c
             JOIN expediente e ON e.id_expediente = c.id_expediente
             JOIN paciente p ON p.id_paciente = e.id_paciente
            WHERE c.id_consulta = $1 AND p.id_institucion = $2`,
          [input.params.id, deps.id_institucion],
        );
        const consulta = found.rows[0];
        if (!consulta) throw new ClinicalError('not_found', NOT_FOUND);
        if (consulta.estado !== 'abierta') throw new ClinicalError('conflict', CONFLICT);

        try {
          const inserted = await postgresQuery<{
            id_signos: number;
            id_consulta: number;
            fecha_hora_toma: string | Date;
            presion_sistolica: number | null;
            presion_diastolica: number | null;
            frecuencia_cardiaca: number | null;
            frecuencia_respiratoria: number | null;
            temperatura_c: unknown;
            saturacion_oxigeno: number | null;
            peso_kg: unknown;
            talla_cm: unknown;
          }>(
            `INSERT INTO signos_vitales (
               id_institucion, id_consulta, fecha_hora_toma,
               presion_sistolica, presion_diastolica, frecuencia_cardiaca, frecuencia_respiratoria,
               temperatura_c, saturacion_oxigeno, peso_kg, talla_cm
             ) VALUES ($1,$2,$3::timestamptz,$4,$5,$6,$7,$8,$9,$10,$11)
             RETURNING *`,
            [
              deps.id_institucion,
              consulta.id_consulta,
              toPgTimestamptz(context.now || deps.clock.nowIso()),
              input.body.presion_sistolica ?? null,
              input.body.presion_diastolica ?? null,
              input.body.frecuencia_cardiaca ?? null,
              input.body.frecuencia_respiratoria ?? null,
              input.body.temperatura_c ?? null,
              input.body.saturacion_oxigeno ?? null,
              input.body.peso_kg ?? null,
              input.body.talla_cm ?? null,
            ],
          );
          const row = inserted.rows[0]!;
          const out: SIGNOS_VITALES = {
            id_signos: row.id_signos,
            id_consulta: row.id_consulta,
            fecha_hora_toma: fromPgTimestamptz(row.fecha_hora_toma),
            ...(row.presion_sistolica != null ? { presion_sistolica: row.presion_sistolica } : {}),
            ...(row.presion_diastolica != null
              ? { presion_diastolica: row.presion_diastolica }
              : {}),
            ...(row.frecuencia_cardiaca != null
              ? { frecuencia_cardiaca: row.frecuencia_cardiaca }
              : {}),
            ...(row.frecuencia_respiratoria != null
              ? { frecuencia_respiratoria: row.frecuencia_respiratoria }
              : {}),
            ...(row.temperatura_c != null
              ? { temperatura_c: Number(fromPgNumeric(row.temperatura_c)) }
              : {}),
            ...(row.saturacion_oxigeno != null
              ? { saturacion_oxigeno: row.saturacion_oxigeno }
              : {}),
            ...(row.peso_kg != null ? { peso_kg: Number(fromPgNumeric(row.peso_kg)) } : {}),
            ...(row.talla_cm != null ? { talla_cm: Number(fromPgNumeric(row.talla_cm)) } : {}),
          };
          return out;
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

    op28: unsupported,
    op29: unsupported,
    op30: unsupported,
    op31: unsupported,
    op32: unsupported,
    op33: unsupported,
    ...createPostgresClinicalMaintenance({ id_institucion: deps.id_institucion }),
  };
}

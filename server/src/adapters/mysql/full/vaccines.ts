import { asPacienteId, type InstitutionId } from '@genki/shared';
import type {
  DOSIS_VACUNA,
  DosisPendiente,
  DosisSchedule,
  Page,
} from '@genki/shared/full/vaccines';
import { ClinicalError } from '../../../domain/clinical-error.js';
import type { ClockPort } from '../../../ports/clock.js';
import type { PacienteRepositoryPort } from '../../../ports/paciente-repository.js';
import type { UnitOfWorkPort } from '../../../ports/unit-of-work.js';
import type { OperationContext } from '../../../ports/full/context.js';
import type {
  Op43Request,
  Op43Response,
  Op44Request,
  Op44Response,
  Op45Request,
  Op45Response,
  Op47Request,
  Op47Response,
  VaccinesRepositoryPort,
} from '../../../ports/full/vaccines.js';
import { fromMysqlDate, toMysqlDate } from '../mapper.js';
import { mysqlQueryResult } from './query.js';

const NOT_FOUND = 'Recurso no encontrado';
const CONFLICT = 'Conflicto de recurso';

function mapDosis(row: Record<string, unknown>): DOSIS_VACUNA {
  return {
    id_dosis: Number(row.id_dosis),
    id_expediente: Number(row.id_expediente),
    id_vacuna: Number(row.id_vacuna),
    numero_dosis: Number(row.numero_dosis),
    fecha_programada: fromMysqlDate(row.fecha_programada as string | Date),
    estado: String(row.estado),
    ...(row.fecha_aplicacion != null
      ? { fecha_aplicacion: fromMysqlDate(row.fecha_aplicacion as string | Date) }
      : {}),
    ...(row.lote != null ? { lote: String(row.lote) } : {}),
    ...(row.fabricante != null ? { fabricante: String(row.fabricante) } : {}),
    ...(row.sitio_aplicacion != null ? { sitio_aplicacion: String(row.sitio_aplicacion) } : {}),
    ...(row.id_profesional != null ? { id_profesional: Number(row.id_profesional) } : {}),
    ...(row.reaccion_adversa != null ? { reaccion_adversa: String(row.reaccion_adversa) } : {}),
  };
}

export function createMysqlVaccinesRepository(deps: {
  id_institucion: InstitutionId;
  pacientes: PacienteRepositoryPort;
  unitOfWork: UnitOfWorkPort;
  clock: ClockPort;
}): VaccinesRepositoryPort {
  return {
    async op43(input: Op43Request, _context: OperationContext): Promise<Op43Response> {
      return deps.unitOfWork.runInTransaction(async () => {
        const expediente = await deps.pacientes.findExpedienteByPaciente(
          asPacienteId(input.params.id),
        );
        if (!expediente) throw new ClinicalError('not_found', NOT_FOUND);
        const today = (deps.clock.nowIso() || new Date().toISOString()).slice(0, 10);
        // OP-43: idempotent scheduled-dose creation from the explicit VACUNA_INTERVALO catalog.
        // fecha_programada = birth date + catalog age in months; never invented dates.
        // The expediente row lock serializes concurrent first reads of the same schedule.
        if (expediente.estado !== 'archivado') {
          await mysqlQueryResult(
            `SELECT id_expediente FROM expediente WHERE id_expediente = ? FOR UPDATE`,
            [expediente.id_expediente],
          );
          await mysqlQueryResult(
            `INSERT INTO dosis_vacuna (
               id_institucion, id_expediente, id_vacuna, numero_dosis, fecha_programada, estado
             )
             SELECT vi.id_institucion, e.id_expediente, vi.id_vacuna, vi.numero_dosis,
                    DATE_ADD(p.fecha_nacimiento, INTERVAL vi.edad_meses MONTH), 'programada'
               FROM expediente e
               JOIN paciente p ON p.id_paciente = e.id_paciente
               JOIN vacuna_intervalo vi ON vi.id_institucion = p.id_institucion
               JOIN vacuna v
                 ON v.id_institucion = vi.id_institucion AND v.id_vacuna = vi.id_vacuna
              WHERE e.id_expediente = ? AND p.id_institucion = ?
                AND vi.numero_dosis <= v.dosis_totales
                AND NOT EXISTS (
                  SELECT 1 FROM dosis_vacuna d
                   WHERE d.id_institucion = vi.id_institucion
                     AND d.id_expediente = e.id_expediente
                     AND d.id_vacuna = vi.id_vacuna
                     AND d.numero_dosis = vi.numero_dosis
                )
              ORDER BY vi.id_vacuna ASC, vi.numero_dosis ASC`,
            [expediente.id_expediente, deps.id_institucion],
          );
        }
        const result = await mysqlQueryResult<Record<string, unknown>>(
          `SELECT d.*, v.nombre AS nombre_vacuna
             FROM dosis_vacuna d
             LEFT JOIN vacuna v
               ON v.id_institucion = d.id_institucion AND v.id_vacuna = d.id_vacuna
            WHERE d.id_institucion = ? AND d.id_expediente = ?
            ORDER BY d.fecha_programada ASC, d.id_vacuna ASC, d.numero_dosis ASC`,
          [deps.id_institucion, expediente.id_expediente],
        );
        return result.rows.map((row): DosisSchedule => {
          const d = mapDosis(row);
          return {
            ...d,
            atrasada: d.estado === 'programada' && d.fecha_programada < today,
            version_esquema: 'MVP-1',
            ...(row.nombre_vacuna != null ? { nombre_vacuna: String(row.nombre_vacuna) } : {}),
          };
        });
      });
    },

    async op44(input: Op44Request, _context: OperationContext): Promise<Op44Response> {
      return deps.unitOfWork.runInTransaction(async () => {
        const found = await mysqlQueryResult<Record<string, unknown>>(
          `SELECT * FROM dosis_vacuna WHERE id_institucion = ? AND id_dosis = ? FOR UPDATE`,
          [deps.id_institucion, input.params.id],
        );
        const row = found.rows[0];
        if (!row) throw new ClinicalError('not_found', NOT_FOUND);
        if (String(row.estado) === 'aplicada') throw new ClinicalError('conflict', CONFLICT);
        await mysqlQueryResult(
          `UPDATE dosis_vacuna SET
             fecha_aplicacion = ?, lote = ?, fabricante = ?, sitio_aplicacion = ?,
             id_profesional = ?, estado = 'aplicada'
           WHERE id_institucion = ? AND id_dosis = ?`,
          [
            toMysqlDate(input.body.fecha_aplicacion),
            input.body.lote,
            input.body.fabricante ?? null,
            input.body.sitio_aplicacion ?? null,
            input.body.id_profesional,
            deps.id_institucion,
            input.params.id,
          ],
        );
        const refreshed = await mysqlQueryResult<Record<string, unknown>>(
          `SELECT * FROM dosis_vacuna WHERE id_institucion = ? AND id_dosis = ?`,
          [deps.id_institucion, input.params.id],
        );
        return mapDosis(refreshed.rows[0]!);
      });
    },

    async op45(input: Op45Request, _context: OperationContext): Promise<Op45Response> {
      return deps.unitOfWork.runInTransaction(async () => {
        const found = await mysqlQueryResult<Record<string, unknown>>(
          `SELECT * FROM dosis_vacuna WHERE id_institucion = ? AND id_dosis = ? FOR UPDATE`,
          [deps.id_institucion, input.params.id],
        );
        const row = found.rows[0];
        if (!row) throw new ClinicalError('not_found', NOT_FOUND);
        if (String(row.estado) !== 'aplicada') throw new ClinicalError('conflict', CONFLICT);
        await mysqlQueryResult(
          `UPDATE dosis_vacuna SET reaccion_adversa = ?
            WHERE id_institucion = ? AND id_dosis = ?`,
          [input.body.reaccion_adversa, deps.id_institucion, input.params.id],
        );
        const refreshed = await mysqlQueryResult<Record<string, unknown>>(
          `SELECT * FROM dosis_vacuna WHERE id_institucion = ? AND id_dosis = ?`,
          [deps.id_institucion, input.params.id],
        );
        return mapDosis(refreshed.rows[0]!);
      });
    },

    async op47(input: Op47Request, _context: OperationContext): Promise<Op47Response> {
      return deps.unitOfWork.runInTransaction(async () => {
        const page = input.query.page ?? 1;
        const page_size = input.query.page_size ?? 20;
        const result = await mysqlQueryResult<Record<string, unknown>>(
          `SELECT d.*, p.id_paciente, v.nombre AS nombre_vacuna,
                  CONCAT(p.primer_nombre, ' ', p.primer_apellido) AS nombre,
                  p.telefono
             FROM dosis_vacuna d
             INNER JOIN expediente e ON e.id_expediente = d.id_expediente
             INNER JOIN paciente p
               ON p.id_institucion = d.id_institucion AND p.id_paciente = e.id_paciente
             LEFT JOIN vacuna v
               ON v.id_institucion = d.id_institucion AND v.id_vacuna = d.id_vacuna
            WHERE d.id_institucion = ?
              AND d.estado = 'programada'
              AND d.fecha_programada <= ?
            ORDER BY d.fecha_programada ASC, d.id_dosis ASC`,
          [deps.id_institucion, toMysqlDate(input.query.hasta)],
        );
        const today = (deps.clock.nowIso() || new Date().toISOString()).slice(0, 10);
        const items: DosisPendiente[] = result.rows.map((row) => {
          const d = mapDosis(row);
          return {
            ...d,
            atrasada: d.fecha_programada < today,
            version_esquema: 'MVP-1',
            ...(row.nombre_vacuna != null ? { nombre_vacuna: String(row.nombre_vacuna) } : {}),
            id_paciente: Number(row.id_paciente),
            nombre: String(row.nombre ?? ''),
            telefono: row.telefono == null ? null : String(row.telefono),
          };
        });
        const start = (page - 1) * page_size;
        const out: Page<DosisPendiente> = {
          items: items.slice(start, start + page_size),
          page,
          page_size,
          total: items.length,
        };
        return out;
      });
    },
  };
}

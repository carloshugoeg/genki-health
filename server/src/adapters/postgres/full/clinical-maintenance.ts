/**
 * Hospital PostgreSQL: OP-31 close of an open consultation and audited corrections of
 * diagnosis / treatment / prescription. All statements run on the caller's transaction client
 * (postgresQuery + AsyncLocalStorage); row locks (FOR UPDATE) on consulta + expediente serialize
 * these writes with OP-18 archive, which also locks the expediente row.
 */
import type {
  ConsultaCompleta,
  DetalleRecetaDto,
  DiagnosticoDto,
  ExpedienteEstado,
  InstitutionId,
  RecetaDto,
  TratamientoDto,
} from '@genki/shared';
import type { ClinicalItemDto } from '@genki/shared/full/consultation';
import { ClinicalError } from '../../../domain/clinical-error.js';
import type { ClinicalItemEntity } from '../../../domain/full/clinical-maintenance.js';
import type {
  BitacoraClinicaEntry,
  CierreConsultaBundle,
  ClinicalItemPatch,
  ClinicalItemSnapshot,
  ConsultaParaCierre,
  ConsultationRepositoryPort,
} from '../../../ports/full/consultation.js';
import {
  isForeignKeyError,
  mapConsulta,
  mapDetalle,
  mapDiagnostico,
  mapReceta,
  mapTratamiento,
  type ConsultaRow,
  type DetalleRow,
  type DiagnosticoRow,
  type RecetaRow,
  type TratamientoRow,
} from '../consulta-repository.js';
import { toPgDate, toPgTimestamptz } from '../mapper.js';
import { postgresQuery } from '../unit-of-work.js';

const NOT_FOUND = 'Recurso no encontrado';
const REFERENCE_NOT_FOUND = 'Referencia de catálogo no encontrada';

export type ClinicalMaintenanceMethods = Pick<
  ConsultationRepositoryPort,
  | 'findConsultaParaCierre'
  | 'guardarCierreConsulta'
  | 'findClinicalItem'
  | 'updateClinicalItem'
  | 'appendBitacora'
>;

/** Locks consulta + expediente of this institution; returns the consulta row and record state. */
const LOCK_CONSULTA = `SELECT c.*, e.estado AS expediente_estado
     FROM consulta c
     JOIN expediente e ON e.id_expediente = c.id_expediente
     JOIN paciente p ON p.id_paciente = e.id_paciente
    WHERE c.id_consulta = $1 AND p.id_institucion = $2
    FOR UPDATE OF c, e`;

const ITEM_SQL: Record<ClinicalItemEntity, string> = {
  diagnostico: `SELECT d.id_diagnostico AS item_id, d.id_consulta FROM diagnostico d
                 WHERE d.id_diagnostico = $1`,
  tratamiento: `SELECT t.id_tratamiento AS item_id, d.id_consulta FROM tratamiento t
                  JOIN diagnostico d ON d.id_diagnostico = t.id_diagnostico
                 WHERE t.id_tratamiento = $1`,
  receta: `SELECT r.id_receta AS item_id, r.id_consulta FROM receta r WHERE r.id_receta = $1`,
};

export function createPostgresClinicalMaintenance(deps: {
  id_institucion: InstitutionId;
}): ClinicalMaintenanceMethods {
  async function lockConsulta(
    id_consulta: number,
  ): Promise<(ConsultaRow & { expediente_estado: ExpedienteEstado }) | null> {
    const found = await postgresQuery<ConsultaRow & { expediente_estado: ExpedienteEstado }>(
      LOCK_CONSULTA,
      [id_consulta, deps.id_institucion],
    );
    return found.rows[0] ?? null;
  }

  async function readItem(entidad: ClinicalItemEntity, id: number): Promise<ClinicalItemDto> {
    if (entidad === 'diagnostico') {
      const r = await postgresQuery<DiagnosticoRow>(
        'SELECT * FROM diagnostico WHERE id_diagnostico = $1',
        [id],
      );
      return { entidad, item: mapDiagnostico(r.rows[0]!) };
    }
    if (entidad === 'tratamiento') {
      const r = await postgresQuery<TratamientoRow>(
        'SELECT * FROM tratamiento WHERE id_tratamiento = $1',
        [id],
      );
      return { entidad, item: mapTratamiento(r.rows[0]!) };
    }
    const r = await postgresQuery<RecetaRow>('SELECT * FROM receta WHERE id_receta = $1', [id]);
    return { entidad, item: mapReceta(r.rows[0]!) };
  }

  return {
    async findConsultaParaCierre(id_consulta: number): Promise<ConsultaParaCierre | null> {
      const row = await lockConsulta(id_consulta);
      if (!row) return null;
      const { expediente_estado, ...consulta } = row;
      return { consulta: mapConsulta(consulta), expediente_estado };
    },

    async guardarCierreConsulta(
      id_consulta: number,
      bundle: CierreConsultaBundle,
    ): Promise<ConsultaCompleta> {
      const locked = await lockConsulta(id_consulta);
      if (!locked) throw new ClinicalError('not_found', NOT_FOUND);
      if (locked.estado !== 'abierta') throw new ClinicalError('conflict', 'Conflicto de recurso');
      try {
        const diagnosticos: DiagnosticoDto[] = [];
        for (const input of bundle.diagnosticos) {
          const inserted = await postgresQuery<DiagnosticoRow>(
            `INSERT INTO diagnostico (
               id_consulta, codigo_cie10, descripcion, tipo, es_principal, fecha_registro
             ) VALUES ($1, $2, $3, $4, $5, $6::timestamptz)
             RETURNING *`,
            [
              id_consulta,
              input.codigo_cie10,
              input.descripcion,
              input.tipo,
              input.es_principal,
              toPgTimestamptz(input.fecha_registro),
            ],
          );
          diagnosticos.push(mapDiagnostico(inserted.rows[0]!));
        }
        const tratamientos: TratamientoDto[] = [];
        for (const input of bundle.tratamientos) {
          const parent = diagnosticos[input.diagnostico_index];
          if (!parent) throw new ClinicalError('invalid_bundle', 'Índice de diagnóstico inválido');
          const inserted = await postgresQuery<TratamientoRow>(
            `INSERT INTO tratamiento (
               id_diagnostico, tipo, descripcion, indicaciones,
               fecha_inicio, fecha_fin_estimada, estado
             ) VALUES ($1, $2, $3, $4, $5::date, $6::date, $7)
             RETURNING *`,
            [
              parent.id_diagnostico,
              input.tipo,
              input.descripcion,
              input.indicaciones,
              toPgDate(input.fecha_inicio),
              input.fecha_fin_estimada == null ? null : toPgDate(input.fecha_fin_estimada),
              input.estado,
            ],
          );
          tratamientos.push(mapTratamiento(inserted.rows[0]!));
        }
        let receta: RecetaDto | null = null;
        const detalles: DetalleRecetaDto[] = [];
        if (bundle.receta) {
          const inserted = await postgresQuery<RecetaRow>(
            `INSERT INTO receta (
               id_consulta, id_profesional, folio, fecha_emision, observaciones, estado
             ) VALUES ($1, $2, $3, $4::timestamptz, $5, $6)
             RETURNING *`,
            [
              id_consulta,
              bundle.receta.header.id_profesional,
              bundle.receta.header.folio,
              toPgTimestamptz(bundle.receta.header.fecha_emision),
              bundle.receta.header.observaciones,
              bundle.receta.header.estado,
            ],
          );
          receta = mapReceta(inserted.rows[0]!);
          for (const input of bundle.receta.detalles) {
            const medication = await postgresQuery(
              'SELECT 1 FROM medicamento WHERE id_medicamento = $1 AND activo = TRUE',
              [input.id_medicamento],
            );
            if (medication.rowCount !== 1)
              throw new ClinicalError('reference_not_found', REFERENCE_NOT_FOUND);
            const detail = await postgresQuery<DetalleRow>(
              `INSERT INTO detalle_receta (
                 id_receta, id_medicamento, dosis, via_administracion,
                 frecuencia_horas, duracion_dias, cantidad, indicaciones
               ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
               RETURNING *`,
              [
                receta.id_receta,
                input.id_medicamento,
                input.dosis,
                input.via_administracion,
                input.frecuencia_horas,
                input.duracion_dias,
                input.cantidad,
                input.indicaciones,
              ],
            );
            detalles.push(mapDetalle(detail.rows[0]!));
          }
        }
        const updated = await postgresQuery<ConsultaRow>(
          `UPDATE consulta
              SET estado = 'cerrada', fecha_hora_fin = $2::timestamptz,
                  enfermedad_actual = $3, exploracion_fisica = $4, plan = $5
            WHERE id_consulta = $1 AND estado = 'abierta'
            RETURNING *`,
          [
            id_consulta,
            toPgTimestamptz(bundle.fecha_hora_fin),
            bundle.enfermedad_actual,
            bundle.exploracion_fisica,
            bundle.plan,
          ],
        );
        if (!updated.rows[0]) throw new ClinicalError('conflict', 'Conflicto de recurso');
        return {
          consulta: mapConsulta(updated.rows[0]),
          diagnosticos,
          tratamientos,
          receta,
          detalles,
        };
      } catch (error) {
        if (isForeignKeyError(error))
          throw new ClinicalError('reference_not_found', REFERENCE_NOT_FOUND);
        throw error;
      }
    },

    async findClinicalItem(
      entidad: ClinicalItemEntity,
      id: number,
    ): Promise<ClinicalItemSnapshot | null> {
      const link = await postgresQuery<{ item_id: number; id_consulta: number }>(
        ITEM_SQL[entidad],
        [id],
      );
      const row = link.rows[0];
      if (!row) return null;
      const consulta = await lockConsulta(row.id_consulta);
      if (!consulta) return null; // another institution's row: same answer as missing
      // Lock the item row itself before reading the state the plan is computed from.
      const table = entidad === 'diagnostico' ? 'diagnostico' : entidad;
      const key =
        entidad === 'diagnostico'
          ? 'id_diagnostico'
          : entidad === 'tratamiento'
            ? 'id_tratamiento'
            : 'id_receta';
      await postgresQuery(`SELECT 1 FROM ${table} WHERE ${key} = $1 FOR UPDATE`, [id]);
      return {
        item: await readItem(entidad, id),
        id_consulta: row.id_consulta,
        consulta_estado: consulta.estado,
        expediente_estado: consulta.expediente_estado,
      };
    },

    async updateClinicalItem(patch: ClinicalItemPatch): Promise<ClinicalItemDto> {
      const sets: string[] = [];
      const values: unknown[] = [patch.id];
      const add = (column: string, value: unknown, cast = '') => {
        values.push(value);
        sets.push(`${column} = $${values.length}${cast}`);
      };
      if (patch.entidad === 'diagnostico') {
        if (patch.tipo !== undefined) add('tipo', patch.tipo);
        if (patch.descripcion !== undefined) add('descripcion', patch.descripcion);
      } else if (patch.entidad === 'tratamiento') {
        if (patch.estado !== undefined) add('estado', patch.estado);
        if (patch.indicaciones !== undefined) add('indicaciones', patch.indicaciones);
        if (patch.fecha_fin_estimada !== undefined)
          add(
            'fecha_fin_estimada',
            patch.fecha_fin_estimada == null ? null : toPgDate(patch.fecha_fin_estimada),
            '::date',
          );
      } else {
        if (patch.estado !== undefined) add('estado', patch.estado);
        if (patch.observaciones !== undefined) add('observaciones', patch.observaciones);
      }
      if (sets.length === 0) throw new ClinicalError('invalid_body', 'Solicitud inválida');
      const key =
        patch.entidad === 'diagnostico'
          ? 'id_diagnostico'
          : patch.entidad === 'tratamiento'
            ? 'id_tratamiento'
            : 'id_receta';
      const result = await postgresQuery(
        `UPDATE ${patch.entidad} SET ${sets.join(', ')} WHERE ${key} = $1`,
        values,
      );
      if (result.rowCount !== 1) throw new ClinicalError('not_found', NOT_FOUND);
      return readItem(patch.entidad, patch.id);
    },

    async appendBitacora(entry: BitacoraClinicaEntry): Promise<void> {
      // BITACORA (Entrega I) lives in Hospital PostgreSQL next to USUARIO, so the audit row
      // commits atomically with the clinical change.
      await postgresQuery(
        `INSERT INTO bitacora (
           id_usuario, entidad, id_registro, accion, fecha_hora, direccion_ip, detalle, id_institucion
         ) VALUES ($1, $2, $3, $4, $5::timestamptz, NULL, $6::jsonb, $7)`,
        [
          entry.id_usuario,
          entry.entidad,
          entry.id_registro,
          entry.accion,
          toPgTimestamptz(entry.fecha_hora),
          JSON.stringify(entry.detalle),
          deps.id_institucion,
        ],
      );
    },
  };
}

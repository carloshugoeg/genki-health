/**
 * Centro pediátrico MySQL: OP-31 close of an open consultation and audited corrections of
 * diagnosis / treatment / prescription. All statements run on the caller's transaction connection
 * (mysqlQuery + AsyncLocalStorage). Row locks (FOR UPDATE OF c, e) on consulta + expediente
 * serialize these writes with OP-18 archive and closeConsulta, which lock the same expediente row.
 * genki_app holds column-level UPDATE on the status/annotation columns only (security.sql), so
 * clinical rows are never deleted and their identity/links/dates never change.
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
import type { ResultSetHeader, RowDataPacket } from 'mysql2';
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
  consultaFromRow,
  detalleFromRow,
  diagnosticoFromRow,
  recetaFromRow,
  tratamientoFromRow,
} from '../consulta-repository.js';
import { toMysqlDate, toMysqlDatetime } from '../mapper.js';
import { mysqlQuery } from '../unit-of-work.js';

const NOT_FOUND = 'Recurso no encontrado';
const CONFLICT = 'Conflicto de recurso';
const REFERENCE_NOT_FOUND = 'Referencia de catálogo no encontrada';
const INVALID_BUNDLE = 'Índice de diagnóstico inválido';

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
     INNER JOIN expediente e ON e.id_expediente = c.id_expediente
     INNER JOIN paciente p ON p.id_paciente = e.id_paciente
    WHERE c.id_consulta = ? AND p.id_institucion = ?
    FOR UPDATE OF c, e`;

const ITEM_LINK_SQL: Record<ClinicalItemEntity, string> = {
  diagnostico: `SELECT d.id_consulta FROM diagnostico d WHERE d.id_diagnostico = ?`,
  tratamiento: `SELECT d.id_consulta FROM tratamiento t
                  INNER JOIN diagnostico d ON d.id_diagnostico = t.id_diagnostico
                 WHERE t.id_tratamiento = ?`,
  receta: `SELECT r.id_consulta FROM receta r WHERE r.id_receta = ?`,
};

const ITEM_KEY: Record<ClinicalItemEntity, string> = {
  diagnostico: 'id_diagnostico',
  tratamiento: 'id_tratamiento',
  receta: 'id_receta',
};

function isMysqlErrno(error: unknown, errno: number): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'errno' in error &&
    (error as { errno: unknown }).errno === errno
  );
}

async function selectRows(sql: string, params: unknown[]): Promise<RowDataPacket[]> {
  const [rows] = await mysqlQuery<RowDataPacket[]>(sql, params);
  return rows;
}

async function insert(sql: string, params: unknown[]): Promise<number> {
  const [header] = await mysqlQuery<ResultSetHeader>(sql, params);
  return Number(header.insertId);
}

export function createMysqlClinicalMaintenance(deps: {
  id_institucion: InstitutionId;
}): ClinicalMaintenanceMethods {
  async function lockConsulta(id_consulta: number): Promise<RowDataPacket | null> {
    const rows = await selectRows(LOCK_CONSULTA, [id_consulta, deps.id_institucion]);
    return rows[0] ?? null;
  }

  async function readItem(entidad: ClinicalItemEntity, id: number): Promise<ClinicalItemDto> {
    const rows = await selectRows(`SELECT * FROM ${entidad} WHERE ${ITEM_KEY[entidad]} = ?`, [id]);
    const row = rows[0];
    if (!row) throw new ClinicalError('not_found', NOT_FOUND);
    if (entidad === 'diagnostico') return { entidad, item: diagnosticoFromRow(row) };
    if (entidad === 'tratamiento') return { entidad, item: tratamientoFromRow(row) };
    return { entidad, item: recetaFromRow(row) };
  }

  async function insertCierre(
    id_consulta: number,
    bundle: CierreConsultaBundle,
  ): Promise<Omit<ConsultaCompleta, 'consulta'>> {
    for (const dx of bundle.diagnosticos) {
      if (dx.codigo_cie10 != null && dx.codigo_cie10 !== '') {
        const cie = await selectRows(
          'SELECT codigo_cie10 FROM catalogo_cie10 WHERE codigo_cie10 = ?',
          [dx.codigo_cie10],
        );
        if (!cie[0]) throw new ClinicalError('reference_not_found', REFERENCE_NOT_FOUND);
      }
    }

    const diagnosticos: DiagnosticoDto[] = [];
    for (const input of bundle.diagnosticos) {
      const id = await insert(
        `INSERT INTO diagnostico (
           id_consulta, codigo_cie10, descripcion, tipo, es_principal, fecha_registro
         ) VALUES (?, ?, ?, ?, ?, ?)`,
        [
          id_consulta,
          input.codigo_cie10,
          input.descripcion,
          input.tipo,
          input.es_principal,
          toMysqlDatetime(input.fecha_registro),
        ],
      );
      const row = (await selectRows('SELECT * FROM diagnostico WHERE id_diagnostico = ?', [id]))[0];
      diagnosticos.push(diagnosticoFromRow(row!));
    }

    const tratamientos: TratamientoDto[] = [];
    for (const input of bundle.tratamientos) {
      const parent = diagnosticos[input.diagnostico_index];
      if (!parent) throw new ClinicalError('invalid_bundle', INVALID_BUNDLE);
      const id = await insert(
        `INSERT INTO tratamiento (
           id_diagnostico, tipo, descripcion, indicaciones,
           fecha_inicio, fecha_fin_estimada, estado
         ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          parent.id_diagnostico,
          input.tipo,
          input.descripcion,
          input.indicaciones,
          toMysqlDate(input.fecha_inicio),
          input.fecha_fin_estimada == null ? null : toMysqlDate(input.fecha_fin_estimada),
          input.estado,
        ],
      );
      const row = (await selectRows('SELECT * FROM tratamiento WHERE id_tratamiento = ?', [id]))[0];
      tratamientos.push(tratamientoFromRow(row!));
    }

    let receta: RecetaDto | null = null;
    const detalles: DetalleRecetaDto[] = [];
    if (bundle.receta) {
      const id_receta = await insert(
        `INSERT INTO receta (
           id_consulta, id_profesional, folio, fecha_emision, observaciones, estado
         ) VALUES (?, ?, ?, ?, ?, ?)`,
        [
          id_consulta,
          bundle.receta.header.id_profesional,
          bundle.receta.header.folio,
          toMysqlDatetime(bundle.receta.header.fecha_emision),
          bundle.receta.header.observaciones,
          bundle.receta.header.estado,
        ],
      );
      const recetaRow = (
        await selectRows('SELECT * FROM receta WHERE id_receta = ?', [id_receta])
      )[0];
      receta = recetaFromRow(recetaRow!);
      for (const input of bundle.receta.detalles) {
        const med = await selectRows(
          'SELECT id_medicamento FROM medicamento WHERE id_medicamento = ? AND activo = TRUE',
          [input.id_medicamento],
        );
        if (!med[0]) throw new ClinicalError('reference_not_found', REFERENCE_NOT_FOUND);
        await insert(
          `INSERT INTO detalle_receta (
             id_receta, id_medicamento, dosis, via_administracion,
             frecuencia_horas, duracion_dias, cantidad, indicaciones
           ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            id_receta,
            input.id_medicamento,
            input.dosis,
            input.via_administracion,
            input.frecuencia_horas,
            input.duracion_dias,
            input.cantidad,
            input.indicaciones,
          ],
        );
      }
      const detalleRows = await selectRows(
        'SELECT * FROM detalle_receta WHERE id_receta = ? ORDER BY id_medicamento ASC',
        [id_receta],
      );
      detalles.push(...detalleRows.map(detalleFromRow));
    }
    return { diagnosticos, tratamientos, receta, detalles };
  }

  return {
    async findConsultaParaCierre(id_consulta: number): Promise<ConsultaParaCierre | null> {
      const row = await lockConsulta(id_consulta);
      if (!row) return null;
      return {
        consulta: consultaFromRow(row),
        expediente_estado: String(row.expediente_estado) as ExpedienteEstado,
      };
    },

    async guardarCierreConsulta(
      id_consulta: number,
      bundle: CierreConsultaBundle,
    ): Promise<ConsultaCompleta> {
      const locked = await lockConsulta(id_consulta);
      if (!locked) throw new ClinicalError('not_found', NOT_FOUND);
      if (String(locked.estado) !== 'abierta') throw new ClinicalError('conflict', CONFLICT);
      try {
        const children = await insertCierre(id_consulta, bundle);
        const [updated] = await mysqlQuery<ResultSetHeader>(
          `UPDATE consulta
              SET estado = 'cerrada', fecha_hora_fin = ?,
                  enfermedad_actual = ?, exploracion_fisica = ?, plan = ?
            WHERE id_consulta = ? AND estado = 'abierta'`,
          [
            toMysqlDatetime(bundle.fecha_hora_fin),
            bundle.enfermedad_actual,
            bundle.exploracion_fisica,
            bundle.plan,
            id_consulta,
          ],
        );
        if (updated.affectedRows !== 1) throw new ClinicalError('conflict', CONFLICT);
        const row = (
          await selectRows('SELECT * FROM consulta WHERE id_consulta = ?', [id_consulta])
        )[0];
        return { consulta: consultaFromRow(row!), ...children };
      } catch (error) {
        if (isMysqlErrno(error, 1452))
          throw new ClinicalError('reference_not_found', REFERENCE_NOT_FOUND);
        throw error;
      }
    },

    async findClinicalItem(
      entidad: ClinicalItemEntity,
      id: number,
    ): Promise<ClinicalItemSnapshot | null> {
      const link = (await selectRows(ITEM_LINK_SQL[entidad], [id]))[0];
      if (!link) return null;
      const id_consulta = Number(link.id_consulta);
      const consulta = await lockConsulta(id_consulta);
      if (!consulta) return null; // another institution's row: same answer as missing
      // Lock the item row itself before reading the state the plan is computed from.
      await selectRows(`SELECT 1 FROM ${entidad} WHERE ${ITEM_KEY[entidad]} = ? FOR UPDATE`, [id]);
      return {
        item: await readItem(entidad, id),
        id_consulta,
        consulta_estado: String(consulta.estado),
        expediente_estado: String(consulta.expediente_estado) as ExpedienteEstado,
      };
    },

    async updateClinicalItem(patch: ClinicalItemPatch): Promise<ClinicalItemDto> {
      const sets: string[] = [];
      const values: unknown[] = [];
      const add = (column: string, value: unknown) => {
        sets.push(`${column} = ?`);
        values.push(value);
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
            patch.fecha_fin_estimada == null ? null : toMysqlDate(patch.fecha_fin_estimada),
          );
      } else {
        if (patch.estado !== undefined) add('estado', patch.estado);
        if (patch.observaciones !== undefined) add('observaciones', patch.observaciones);
      }
      if (sets.length === 0) throw new ClinicalError('invalid_body', 'Solicitud inválida');
      await mysqlQuery<ResultSetHeader>(
        `UPDATE ${patch.entidad} SET ${sets.join(', ')} WHERE ${ITEM_KEY[patch.entidad]} = ?`,
        [...values, patch.id],
      );
      // readItem throws not_found when the row is missing (affectedRows is 0 for a no-op update).
      return readItem(patch.entidad, patch.id);
    },

    async appendBitacora(entry: BitacoraClinicaEntry): Promise<void> {
      // BITACORA (Entrega I) lives next to the clinical rows of this engine, so the audit row
      // commits atomically with the clinical change. USUARIO lives in the Hospital PostgreSQL
      // identity store, hence no FK on id_usuario.
      await insert(
        `INSERT INTO bitacora (
           id_institucion, id_usuario, entidad, id_registro, accion, fecha_hora, direccion_ip, detalle
         ) VALUES (?, ?, ?, ?, ?, ?, NULL, ?)`,
        [
          deps.id_institucion,
          entry.id_usuario,
          entry.entidad,
          entry.id_registro,
          entry.accion,
          toMysqlDatetime(entry.fecha_hora),
          JSON.stringify(entry.detalle),
        ],
      );
    },
  };
}

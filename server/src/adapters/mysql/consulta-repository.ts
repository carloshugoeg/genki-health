import type {
  ConsultaCompleta,
  ConsultaDto,
  ConsultaId,
  DetalleRecetaDto,
  DiagnosticoDto,
  DiagnosticoId,
  ExpedienteId,
  InstitutionId,
  RecetaDto,
  RecetaId,
  TratamientoDto,
  TratamientoId,
} from '@genki/shared';
import { asConsultaId } from '@genki/shared';
import type { ResultSetHeader, RowDataPacket } from 'mysql2';
import { ClinicalError } from '../../domain/clinical-error.js';
import type {
  CloseConsultaBundle,
  ConsultaRepositoryPort,
  PersistenceCheckpoint,
  UnitOfWorkPort,
} from '../../ports/index.js';
import {
  fromMysqlBoolean,
  fromMysqlDate,
  fromMysqlDatetime,
  fromMysqlDecimal,
  toMysqlDate,
  toMysqlDatetime,
} from './mapper.js';
import { mysqlQuery } from './unit-of-work.js';

const REFERENCE_NOT_FOUND = 'Referencia de catálogo no encontrada';
const EXPEDIENTE_ARCHIVED = 'El expediente está archivado';
const NOT_FOUND = 'Recurso no encontrado';
const INVALID_BUNDLE = 'Índice de diagnóstico inválido';

function cloneDto<T>(value: T): T {
  return structuredClone(value);
}

function asDiagnosticoId(value: number): DiagnosticoId {
  return value as DiagnosticoId;
}

function asTratamientoId(value: number): TratamientoId {
  return value as TratamientoId;
}

function asRecetaId(value: number): RecetaId {
  return value as RecetaId;
}

function isMysqlErrno(error: unknown, errno: number): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'errno' in error &&
    (error as { errno: unknown }).errno === errno
  );
}

function mapReferenceFailure(error: unknown): never {
  if (isMysqlErrno(error, 1452)) {
    throw new ClinicalError('reference_not_found', REFERENCE_NOT_FOUND);
  }
  throw error;
}

export function consultaFromRow(row: RowDataPacket): ConsultaDto {
  return {
    id_consulta: asConsultaId(Number(row.id_consulta)),
    id_expediente: Number(row.id_expediente) as ExpedienteId,
    id_profesional: Number(row.id_profesional) as ConsultaDto['id_profesional'],
    id_cita: row.id_cita == null ? null : Number(row.id_cita),
    fecha_hora_inicio: fromMysqlDatetime(row.fecha_hora_inicio),
    fecha_hora_fin: row.fecha_hora_fin == null ? null : fromMysqlDatetime(row.fecha_hora_fin),
    tipo: String(row.tipo),
    motivo_consulta: String(row.motivo_consulta),
    enfermedad_actual: row.enfermedad_actual == null ? null : String(row.enfermedad_actual),
    exploracion_fisica: row.exploracion_fisica == null ? null : String(row.exploracion_fisica),
    plan: row.plan == null ? null : String(row.plan),
    estado: String(row.estado),
  };
}

export function diagnosticoFromRow(row: RowDataPacket): DiagnosticoDto {
  return {
    id_diagnostico: asDiagnosticoId(Number(row.id_diagnostico)),
    id_consulta: asConsultaId(Number(row.id_consulta)),
    codigo_cie10: row.codigo_cie10 == null ? null : String(row.codigo_cie10),
    descripcion: String(row.descripcion),
    tipo: String(row.tipo),
    es_principal: fromMysqlBoolean(row.es_principal),
    fecha_registro: fromMysqlDatetime(row.fecha_registro),
  };
}

export function tratamientoFromRow(row: RowDataPacket): TratamientoDto {
  return {
    id_tratamiento: asTratamientoId(Number(row.id_tratamiento)),
    id_diagnostico: asDiagnosticoId(Number(row.id_diagnostico)),
    tipo: String(row.tipo),
    descripcion: String(row.descripcion),
    indicaciones: row.indicaciones == null ? null : String(row.indicaciones),
    fecha_inicio: fromMysqlDate(row.fecha_inicio),
    fecha_fin_estimada:
      row.fecha_fin_estimada == null ? null : fromMysqlDate(row.fecha_fin_estimada),
    estado: String(row.estado),
  };
}

export function recetaFromRow(row: RowDataPacket): RecetaDto {
  return {
    id_receta: asRecetaId(Number(row.id_receta)),
    id_consulta: asConsultaId(Number(row.id_consulta)),
    id_profesional: Number(row.id_profesional) as RecetaDto['id_profesional'],
    folio: String(row.folio),
    fecha_emision: fromMysqlDatetime(row.fecha_emision),
    observaciones: row.observaciones == null ? null : String(row.observaciones),
    estado: String(row.estado),
  };
}

export function detalleFromRow(row: RowDataPacket): DetalleRecetaDto {
  return {
    id_receta: asRecetaId(Number(row.id_receta)),
    id_medicamento: Number(row.id_medicamento),
    dosis: String(row.dosis),
    via_administracion: String(row.via_administracion),
    frecuencia_horas: Number(row.frecuencia_horas),
    duracion_dias: Number(row.duracion_dias),
    cantidad: fromMysqlDecimal(row.cantidad),
    indicaciones: row.indicaciones == null ? null : String(row.indicaciones),
  };
}

export class MysqlConsultaRepository implements ConsultaRepositoryPort {
  constructor(
    private readonly id_institucion: InstitutionId,
    private readonly unitOfWork: UnitOfWorkPort,
    private readonly afterWrite: (point: PersistenceCheckpoint) => void = () => {},
  ) {}

  async closeConsulta(bundle: CloseConsultaBundle): Promise<ConsultaCompleta> {
    return this.unitOfWork.runInTransaction(async () => {
      const [expedienteRows] = await mysqlQuery<RowDataPacket[]>(
        `SELECT e.id_expediente, e.estado
           FROM expediente e
           INNER JOIN paciente p ON p.id_paciente = e.id_paciente
          WHERE p.id_institucion = ? AND e.id_expediente = ?
          FOR UPDATE OF e`,
        [this.id_institucion, bundle.consulta.id_expediente],
      );
      const expediente = expedienteRows[0];
      if (!expediente) {
        throw new ClinicalError('not_found', NOT_FOUND);
      }
      if (String(expediente.estado) === 'archivado') {
        throw new ClinicalError('expediente_archived', EXPEDIENTE_ARCHIVED);
      }

      const [profesionalRows] = await mysqlQuery<RowDataPacket[]>(
        `SELECT id_profesional
           FROM profesional
          WHERE id_institucion = ? AND id_profesional = ? AND activo = TRUE`,
        [this.id_institucion, bundle.consulta.id_profesional],
      );
      if (!profesionalRows[0]) {
        throw new ClinicalError('reference_not_found', REFERENCE_NOT_FOUND);
      }

      for (const dx of bundle.diagnosticos) {
        if (dx.codigo_cie10 != null && dx.codigo_cie10 !== '') {
          const [cieRows] = await mysqlQuery<RowDataPacket[]>(
            `SELECT codigo_cie10 FROM catalogo_cie10 WHERE codigo_cie10 = ?`,
            [dx.codigo_cie10],
          );
          if (!cieRows[0]) {
            throw new ClinicalError('reference_not_found', REFERENCE_NOT_FOUND);
          }
        }
      }

      let id_consulta: ConsultaId;
      try {
        const [consultaHeader] = await mysqlQuery<ResultSetHeader>(
          `INSERT INTO consulta (
             id_expediente, id_profesional, id_cita,
             fecha_hora_inicio, fecha_hora_fin, tipo, motivo_consulta,
             enfermedad_actual, exploracion_fisica, plan, estado
           ) VALUES (?, ?, NULL, ?, ?, ?, ?, ?, ?, ?, 'cerrada')`,
          [
            bundle.consulta.id_expediente,
            bundle.consulta.id_profesional,
            toMysqlDatetime(bundle.consulta.fecha_hora_inicio),
            toMysqlDatetime(bundle.consulta.fecha_hora_fin!),
            bundle.consulta.tipo,
            bundle.consulta.motivo_consulta,
            bundle.consulta.enfermedad_actual,
            bundle.consulta.exploracion_fisica,
            bundle.consulta.plan,
          ],
        );
        id_consulta = asConsultaId(Number(consultaHeader.insertId));
      } catch (error) {
        mapReferenceFailure(error);
      }
      this.afterWrite('afterConsulta');

      const diagnosisIds: DiagnosticoId[] = [];
      for (let i = 0; i < bundle.diagnosticos.length; i += 1) {
        const dxInput = bundle.diagnosticos[i]!;
        try {
          const [dxHeader] = await mysqlQuery<ResultSetHeader>(
            `INSERT INTO diagnostico (
               id_consulta, codigo_cie10, descripcion, tipo, es_principal, fecha_registro
             ) VALUES (?, ?, ?, ?, ?, ?)`,
            [
              id_consulta,
              dxInput.codigo_cie10,
              dxInput.descripcion,
              dxInput.tipo,
              dxInput.es_principal,
              toMysqlDatetime(dxInput.fecha_registro),
            ],
          );
          diagnosisIds.push(asDiagnosticoId(Number(dxHeader.insertId)));
        } catch (error) {
          mapReferenceFailure(error);
        }
        this.afterWrite('afterDiagnostico');
      }

      for (const txInput of bundle.tratamientos) {
        const id_diagnostico = diagnosisIds[txInput.diagnostico_index];
        if (id_diagnostico == null) {
          throw new ClinicalError('invalid_bundle', INVALID_BUNDLE);
        }
        try {
          await mysqlQuery<ResultSetHeader>(
            `INSERT INTO tratamiento (
               id_diagnostico, tipo, descripcion, indicaciones,
               fecha_inicio, fecha_fin_estimada, estado
             ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [
              id_diagnostico,
              txInput.tipo,
              txInput.descripcion,
              txInput.indicaciones,
              toMysqlDate(txInput.fecha_inicio),
              txInput.fecha_fin_estimada == null ? null : toMysqlDate(txInput.fecha_fin_estimada),
              txInput.estado,
            ],
          );
        } catch (error) {
          mapReferenceFailure(error);
        }
      }

      if (bundle.receta) {
        let id_receta: RecetaId;
        try {
          const [recetaHeader] = await mysqlQuery<ResultSetHeader>(
            `INSERT INTO receta (
               id_consulta, id_profesional, folio, fecha_emision, observaciones, estado
             ) VALUES (?, ?, ?, ?, ?, 'emitida')`,
            [
              id_consulta,
              bundle.receta.header.id_profesional,
              bundle.receta.header.folio,
              toMysqlDatetime(bundle.receta.header.fecha_emision),
              bundle.receta.header.observaciones,
            ],
          );
          id_receta = asRecetaId(Number(recetaHeader.insertId));
        } catch (error) {
          mapReferenceFailure(error);
        }

        for (const detalleInput of bundle.receta.detalles) {
          const [medRows] = await mysqlQuery<RowDataPacket[]>(
            `SELECT id_medicamento FROM medicamento WHERE id_medicamento = ? AND activo = TRUE`,
            [detalleInput.id_medicamento],
          );
          if (!medRows[0]) {
            throw new ClinicalError('reference_not_found', REFERENCE_NOT_FOUND);
          }
          try {
            await mysqlQuery<ResultSetHeader>(
              `INSERT INTO detalle_receta (
                 id_receta, id_medicamento, dosis, via_administracion,
                 frecuencia_horas, duracion_dias, cantidad, indicaciones
               ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
              [
                id_receta,
                detalleInput.id_medicamento,
                detalleInput.dosis,
                detalleInput.via_administracion,
                detalleInput.frecuencia_horas,
                detalleInput.duracion_dias,
                detalleInput.cantidad,
                detalleInput.indicaciones,
              ],
            );
          } catch (error) {
            mapReferenceFailure(error);
          }
        }
      }

      return this.assembleCompleta(id_consulta);
    });
  }

  async findById(id: ConsultaId): Promise<ConsultaDto | null> {
    const [rows] = await mysqlQuery<RowDataPacket[]>(
      `SELECT c.*
         FROM consulta c
         INNER JOIN expediente e ON e.id_expediente = c.id_expediente
         INNER JOIN paciente p ON p.id_paciente = e.id_paciente
        WHERE p.id_institucion = ? AND c.id_consulta = ?`,
      [this.id_institucion, id],
    );
    const row = rows[0];
    return row ? cloneDto(consultaFromRow(row)) : null;
  }

  async listByExpediente(id: ExpedienteId): Promise<ConsultaCompleta[]> {
    const [consultaRows] = await mysqlQuery<RowDataPacket[]>(
      `SELECT c.*
         FROM consulta c
         INNER JOIN expediente e ON e.id_expediente = c.id_expediente
         INNER JOIN paciente p ON p.id_paciente = e.id_paciente
        WHERE p.id_institucion = ? AND c.id_expediente = ?
        ORDER BY c.fecha_hora_inicio DESC, c.id_consulta DESC`,
      [this.id_institucion, id],
    );
    const result: ConsultaCompleta[] = [];
    for (const row of consultaRows) {
      result.push(await this.assembleCompleta(asConsultaId(Number(row.id_consulta))));
    }
    return result;
  }

  private async assembleCompleta(id_consulta: ConsultaId): Promise<ConsultaCompleta> {
    const [consultaRows] = await mysqlQuery<RowDataPacket[]>(
      `SELECT c.*
         FROM consulta c
         INNER JOIN expediente e ON e.id_expediente = c.id_expediente
         INNER JOIN paciente p ON p.id_paciente = e.id_paciente
        WHERE p.id_institucion = ? AND c.id_consulta = ?`,
      [this.id_institucion, id_consulta],
    );
    const consultaRow = consultaRows[0];
    if (!consultaRow) {
      throw new ClinicalError('not_found', NOT_FOUND);
    }
    const consulta = cloneDto(consultaFromRow(consultaRow));

    const [diagnosticoRows] = await mysqlQuery<RowDataPacket[]>(
      `SELECT * FROM diagnostico WHERE id_consulta = ? ORDER BY id_diagnostico ASC`,
      [id_consulta],
    );
    const diagnosticos = diagnosticoRows.map((row) => cloneDto(diagnosticoFromRow(row)));
    const dxIds = diagnosticos.map((dx) => dx.id_diagnostico);

    let tratamientos: TratamientoDto[] = [];
    if (dxIds.length > 0) {
      const placeholders = dxIds.map(() => '?').join(', ');
      const [tratamientoRows] = await mysqlQuery<RowDataPacket[]>(
        `SELECT * FROM tratamiento
          WHERE id_diagnostico IN (${placeholders})
          ORDER BY id_tratamiento ASC`,
        dxIds,
      );
      tratamientos = tratamientoRows.map((row) => cloneDto(tratamientoFromRow(row)));
    }

    const [recetaRows] = await mysqlQuery<RowDataPacket[]>(
      `SELECT * FROM receta WHERE id_consulta = ?`,
      [id_consulta],
    );
    const recetaRow = recetaRows[0];
    if (!recetaRow) {
      return {
        consulta,
        diagnosticos,
        tratamientos,
        receta: null,
        detalles: [],
      };
    }
    const receta = cloneDto(recetaFromRow(recetaRow));
    const [detalleRows] = await mysqlQuery<RowDataPacket[]>(
      `SELECT * FROM detalle_receta WHERE id_receta = ? ORDER BY id_medicamento ASC`,
      [receta.id_receta],
    );
    const detalles = detalleRows.map((row) => cloneDto(detalleFromRow(row)));
    return { consulta, diagnosticos, tratamientos, receta, detalles };
  }
}

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
import pg from 'pg';
import { ClinicalError } from '../../domain/clinical-error.js';
import type {
  CloseConsultaBundle,
  ConsultaRepositoryPort,
  PersistenceCheckpoint,
  UnitOfWorkPort,
} from '../../ports/index.js';
import {
  fromPgDate,
  fromPgNumeric,
  fromPgTimestamptz,
  toPgDate,
  toPgTimestamptz,
} from './mapper.js';
import { postgresQuery } from './unit-of-work.js';

const NOT_FOUND = 'Recurso no encontrado';
const EXPEDIENTE_ARCHIVED = 'El expediente está archivado';
const REFERENCE_NOT_FOUND = 'Referencia de catálogo no encontrada';

export interface ConsultaRow extends Omit<
  ConsultaDto,
  'id_consulta' | 'id_expediente' | 'fecha_hora_inicio' | 'fecha_hora_fin'
> {
  id_consulta: number;
  id_expediente: number;
  fecha_hora_inicio: string | Date;
  fecha_hora_fin: string | Date | null;
}

export interface DiagnosticoRow extends Omit<
  DiagnosticoDto,
  'id_diagnostico' | 'id_consulta' | 'fecha_registro'
> {
  id_diagnostico: number;
  id_consulta: number;
  fecha_registro: string | Date;
}

export interface TratamientoRow extends Omit<
  TratamientoDto,
  'id_tratamiento' | 'id_diagnostico' | 'fecha_inicio' | 'fecha_fin_estimada'
> {
  id_tratamiento: number;
  id_diagnostico: number;
  fecha_inicio: string | Date;
  fecha_fin_estimada: string | Date | null;
}

export interface RecetaRow extends Omit<RecetaDto, 'id_receta' | 'id_consulta' | 'fecha_emision'> {
  id_receta: number;
  id_consulta: number;
  fecha_emision: string | Date;
}

export interface DetalleRow extends Omit<DetalleRecetaDto, 'id_receta' | 'cantidad'> {
  id_receta: number;
  cantidad: unknown;
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

export function mapConsulta(row: ConsultaRow): ConsultaDto {
  return {
    ...row,
    id_consulta: asConsultaId(row.id_consulta),
    id_expediente: row.id_expediente as ExpedienteId,
    fecha_hora_inicio: fromPgTimestamptz(row.fecha_hora_inicio),
    fecha_hora_fin: row.fecha_hora_fin == null ? null : fromPgTimestamptz(row.fecha_hora_fin),
  };
}

export function mapDiagnostico(row: DiagnosticoRow): DiagnosticoDto {
  return {
    ...row,
    id_diagnostico: asDiagnosticoId(row.id_diagnostico),
    id_consulta: asConsultaId(row.id_consulta),
    fecha_registro: fromPgTimestamptz(row.fecha_registro),
  };
}

export function mapTratamiento(row: TratamientoRow): TratamientoDto {
  return {
    ...row,
    id_tratamiento: asTratamientoId(row.id_tratamiento),
    id_diagnostico: asDiagnosticoId(row.id_diagnostico),
    fecha_inicio: fromPgDate(row.fecha_inicio),
    fecha_fin_estimada: row.fecha_fin_estimada == null ? null : fromPgDate(row.fecha_fin_estimada),
  };
}

export function mapReceta(row: RecetaRow): RecetaDto {
  return {
    ...row,
    id_receta: asRecetaId(row.id_receta),
    id_consulta: asConsultaId(row.id_consulta),
    fecha_emision: fromPgTimestamptz(row.fecha_emision),
  };
}

export function mapDetalle(row: DetalleRow): DetalleRecetaDto {
  return {
    ...row,
    id_receta: asRecetaId(row.id_receta),
    cantidad: fromPgNumeric(row.cantidad),
  };
}

export function isForeignKeyError(error: unknown): boolean {
  return error instanceof pg.DatabaseError && error.code === '23503';
}

export class PostgresConsultaRepository implements ConsultaRepositoryPort {
  constructor(
    private readonly id_institucion: InstitutionId,
    private readonly unitOfWork: UnitOfWorkPort,
    private readonly afterWrite: (point: PersistenceCheckpoint) => void = () => {},
  ) {}

  async closeConsulta(bundle: CloseConsultaBundle): Promise<ConsultaCompleta> {
    return this.unitOfWork.runInTransaction(async () => {
      const expediente = await postgresQuery<{ estado: 'activo' | 'archivado' }>(
        `SELECT e.estado
           FROM expediente e
           JOIN paciente p ON p.id_paciente = e.id_paciente
          WHERE e.id_expediente = $1 AND p.id_institucion = $2
          FOR UPDATE OF e`,
        [bundle.consulta.id_expediente, this.id_institucion],
      );
      const record = expediente.rows[0];
      if (!record) {
        throw new ClinicalError('not_found', NOT_FOUND);
      }
      if (record.estado === 'archivado') {
        throw new ClinicalError('expediente_archived', EXPEDIENTE_ARCHIVED);
      }

      const professional = await postgresQuery(
        `SELECT 1
           FROM profesional
          WHERE id_profesional = $1 AND id_institucion = $2 AND activo = TRUE`,
        [bundle.consulta.id_profesional, this.id_institucion],
      );
      if (professional.rowCount !== 1) {
        throw new ClinicalError('reference_not_found', REFERENCE_NOT_FOUND);
      }

      for (const treatment of bundle.tratamientos) {
        if (bundle.diagnosticos[treatment.diagnostico_index] == null) {
          throw new ClinicalError('invalid_bundle', 'Índice de diagnóstico inválido');
        }
      }

      try {
        const insertedConsulta = await postgresQuery<ConsultaRow>(
          `INSERT INTO consulta (
             id_expediente, id_profesional, id_cita, fecha_hora_inicio, fecha_hora_fin,
             tipo, motivo_consulta, enfermedad_actual, exploracion_fisica, plan, estado
           ) VALUES ($1, $2, $3, $4::timestamptz, $5::timestamptz, $6, $7, $8, $9, $10, $11)
           RETURNING *`,
          [
            bundle.consulta.id_expediente,
            bundle.consulta.id_profesional,
            bundle.consulta.id_cita,
            toPgTimestamptz(bundle.consulta.fecha_hora_inicio),
            bundle.consulta.fecha_hora_fin == null
              ? null
              : toPgTimestamptz(bundle.consulta.fecha_hora_fin),
            bundle.consulta.tipo,
            bundle.consulta.motivo_consulta,
            bundle.consulta.enfermedad_actual,
            bundle.consulta.exploracion_fisica,
            bundle.consulta.plan,
            bundle.consulta.estado,
          ],
        );
        const consulta = mapConsulta(insertedConsulta.rows[0]!);
        this.afterWrite('afterConsulta');

        const diagnosticos: DiagnosticoDto[] = [];
        for (const input of bundle.diagnosticos) {
          const inserted = await postgresQuery<DiagnosticoRow>(
            `INSERT INTO diagnostico (
               id_consulta, codigo_cie10, descripcion, tipo, es_principal, fecha_registro
             ) VALUES ($1, $2, $3, $4, $5, $6::timestamptz)
             RETURNING *`,
            [
              consulta.id_consulta,
              input.codigo_cie10,
              input.descripcion,
              input.tipo,
              input.es_principal,
              toPgTimestamptz(input.fecha_registro),
            ],
          );
          diagnosticos.push(mapDiagnostico(inserted.rows[0]!));
          this.afterWrite('afterDiagnostico');
        }

        const tratamientos: TratamientoDto[] = [];
        for (const input of bundle.tratamientos) {
          const inserted = await postgresQuery<TratamientoRow>(
            `INSERT INTO tratamiento (
               id_diagnostico, tipo, descripcion, indicaciones,
               fecha_inicio, fecha_fin_estimada, estado
             ) VALUES ($1, $2, $3, $4, $5::date, $6::date, $7)
             RETURNING *`,
            [
              diagnosticos[input.diagnostico_index]!.id_diagnostico,
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
              consulta.id_consulta,
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
              `SELECT 1 FROM medicamento WHERE id_medicamento = $1 AND activo = TRUE`,
              [input.id_medicamento],
            );
            if (medication.rowCount !== 1) {
              throw new ClinicalError('reference_not_found', REFERENCE_NOT_FOUND);
            }
            const insertedDetail = await postgresQuery<DetalleRow>(
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
            detalles.push(mapDetalle(insertedDetail.rows[0]!));
          }
        }

        return { consulta, diagnosticos, tratamientos, receta, detalles };
      } catch (error) {
        if (isForeignKeyError(error)) {
          throw new ClinicalError('reference_not_found', REFERENCE_NOT_FOUND);
        }
        throw error;
      }
    });
  }

  async findById(id: ConsultaId): Promise<ConsultaDto | null> {
    const result = await postgresQuery<ConsultaRow>(
      `SELECT c.*
         FROM consulta c
         JOIN expediente e ON e.id_expediente = c.id_expediente
         JOIN paciente p ON p.id_paciente = e.id_paciente
        WHERE c.id_consulta = $1 AND p.id_institucion = $2`,
      [id, this.id_institucion],
    );
    return result.rows[0] ? mapConsulta(result.rows[0]) : null;
  }

  async listByExpediente(id: ExpedienteId): Promise<ConsultaCompleta[]> {
    const consultas = await postgresQuery<ConsultaRow>(
      `SELECT c.*
         FROM consulta c
         JOIN expediente e ON e.id_expediente = c.id_expediente
         JOIN paciente p ON p.id_paciente = e.id_paciente
        WHERE c.id_expediente = $1 AND p.id_institucion = $2
        ORDER BY c.fecha_hora_inicio DESC, c.id_consulta DESC`,
      [id, this.id_institucion],
    );
    if (consultas.rows.length === 0) {
      return [];
    }

    const ids = consultas.rows.map((row) => row.id_consulta);
    const [diagnosticosResult, tratamientosResult, recetasResult, detallesResult] =
      await Promise.all([
        postgresQuery<DiagnosticoRow>(
          `SELECT d.* FROM diagnostico d
          WHERE d.id_consulta = ANY($1::int[]) ORDER BY d.id_diagnostico ASC`,
          [ids],
        ),
        postgresQuery<TratamientoRow>(
          `SELECT t.* FROM tratamiento t
          JOIN diagnostico d ON d.id_diagnostico = t.id_diagnostico
         WHERE d.id_consulta = ANY($1::int[]) ORDER BY t.id_tratamiento ASC`,
          [ids],
        ),
        postgresQuery<RecetaRow>(
          `SELECT r.* FROM receta r
          WHERE r.id_consulta = ANY($1::int[]) ORDER BY r.id_receta ASC`,
          [ids],
        ),
        postgresQuery<DetalleRow>(
          `SELECT dr.* FROM detalle_receta dr
          JOIN receta r ON r.id_receta = dr.id_receta
         WHERE r.id_consulta = ANY($1::int[])
         ORDER BY dr.id_receta ASC, dr.id_medicamento ASC`,
          [ids],
        ),
      ]);

    const diagnosticos = diagnosticosResult.rows.map(mapDiagnostico);
    const tratamientos = tratamientosResult.rows.map(mapTratamiento);
    const recetas = recetasResult.rows.map(mapReceta);
    const detalles = detallesResult.rows.map(mapDetalle);

    return consultas.rows.map((row) => {
      const consulta = mapConsulta(row);
      const ownDiagnosticos = diagnosticos.filter(
        (diagnostico) => diagnostico.id_consulta === consulta.id_consulta,
      );
      const diagnosisIds = new Set(ownDiagnosticos.map((item) => item.id_diagnostico));
      const receta = recetas.find((item) => item.id_consulta === consulta.id_consulta) ?? null;
      return {
        consulta,
        diagnosticos: ownDiagnosticos,
        tratamientos: tratamientos.filter((item) => diagnosisIds.has(item.id_diagnostico)),
        receta,
        detalles:
          receta == null ? [] : detalles.filter((item) => item.id_receta === receta.id_receta),
      };
    });
  }
}

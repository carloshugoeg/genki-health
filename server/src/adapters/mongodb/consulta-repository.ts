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
import type { Db, Document, FindOptions, InsertOneOptions, UpdateOptions } from 'mongodb';
import { ClinicalError } from '../../domain/clinical-error.js';
import type {
  CloseConsultaBundle,
  ConsultaRepositoryPort,
  IdPort,
  PersistenceCheckpoint,
  UnitOfWorkPort,
} from '../../ports/index.js';
import {
  asPlainInt,
  fromBsonDate,
  makeDocumentId,
  toBsonDate,
  toBsonInt,
  type MongoStringIdDoc,
} from './mapper.js';
import { activeMongoSession } from './unit-of-work.js';

const REFERENCE_NOT_FOUND = 'Referencia de catálogo no encontrada';
const EXPEDIENTE_ARCHIVED = 'El expediente está archivado';
const NOT_FOUND = 'Recurso no encontrado';

function sessionOpts():
  | Pick<FindOptions, 'session'>
  | Pick<InsertOneOptions, 'session'>
  | Pick<UpdateOptions, 'session'>
  | Record<string, never> {
  const session = activeMongoSession();
  return session ? { session } : {};
}

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

function bsonCantidad(value: number): number {
  return value;
}

function diagnosticoToBson(dx: DiagnosticoDto): Document {
  return {
    id_diagnostico: toBsonInt(dx.id_diagnostico),
    id_consulta: toBsonInt(dx.id_consulta),
    codigo_cie10: dx.codigo_cie10,
    descripcion: dx.descripcion,
    tipo: dx.tipo,
    es_principal: dx.es_principal,
    fecha_registro: toBsonDate(dx.fecha_registro),
  };
}

function tratamientoToBson(tx: TratamientoDto): Document {
  return {
    id_tratamiento: toBsonInt(tx.id_tratamiento),
    id_diagnostico: toBsonInt(tx.id_diagnostico),
    tipo: tx.tipo,
    descripcion: tx.descripcion,
    indicaciones: tx.indicaciones,
    fecha_inicio: tx.fecha_inicio,
    fecha_fin_estimada: tx.fecha_fin_estimada,
    estado: tx.estado,
  };
}

function recetaToBson(receta: RecetaDto): Document {
  return {
    id_receta: toBsonInt(receta.id_receta),
    id_consulta: toBsonInt(receta.id_consulta),
    id_profesional: toBsonInt(receta.id_profesional),
    folio: receta.folio,
    fecha_emision: toBsonDate(receta.fecha_emision),
    observaciones: receta.observaciones,
    estado: receta.estado,
  };
}

function detalleToBson(detalle: DetalleRecetaDto): Document {
  return {
    id_receta: toBsonInt(detalle.id_receta),
    id_medicamento: toBsonInt(detalle.id_medicamento),
    dosis: detalle.dosis,
    via_administracion: detalle.via_administracion,
    frecuencia_horas: toBsonInt(detalle.frecuencia_horas),
    duracion_dias: toBsonInt(detalle.duracion_dias),
    cantidad: bsonCantidad(detalle.cantidad),
    indicaciones: detalle.indicaciones,
  };
}

function diagnosticoFromDoc(doc: Document): DiagnosticoDto {
  return {
    id_diagnostico: asDiagnosticoId(asPlainInt(doc.id_diagnostico)),
    id_consulta: asConsultaId(asPlainInt(doc.id_consulta)),
    codigo_cie10: doc.codigo_cie10 == null ? null : String(doc.codigo_cie10),
    descripcion: String(doc.descripcion),
    tipo: doc.tipo as DiagnosticoDto['tipo'],
    es_principal: Boolean(doc.es_principal),
    fecha_registro: fromBsonDate(doc.fecha_registro as Date | string),
  };
}

function tratamientoFromDoc(doc: Document): TratamientoDto {
  return {
    id_tratamiento: asTratamientoId(asPlainInt(doc.id_tratamiento)),
    id_diagnostico: asDiagnosticoId(asPlainInt(doc.id_diagnostico)),
    tipo: doc.tipo as TratamientoDto['tipo'],
    descripcion: String(doc.descripcion),
    indicaciones: doc.indicaciones == null ? null : String(doc.indicaciones),
    fecha_inicio: String(doc.fecha_inicio),
    fecha_fin_estimada: doc.fecha_fin_estimada == null ? null : String(doc.fecha_fin_estimada),
    estado: doc.estado as TratamientoDto['estado'],
  };
}

function recetaFromDoc(doc: Document): RecetaDto {
  return {
    id_receta: asRecetaId(asPlainInt(doc.id_receta)),
    id_consulta: asConsultaId(asPlainInt(doc.id_consulta)),
    id_profesional: asPlainInt(doc.id_profesional) as RecetaDto['id_profesional'],
    folio: String(doc.folio),
    fecha_emision: fromBsonDate(doc.fecha_emision as Date | string),
    observaciones: doc.observaciones == null ? null : String(doc.observaciones),
    estado: doc.estado as RecetaDto['estado'],
  };
}

function detalleFromDoc(doc: Document): DetalleRecetaDto {
  return {
    id_receta: asRecetaId(asPlainInt(doc.id_receta)),
    id_medicamento: asPlainInt(doc.id_medicamento),
    dosis: String(doc.dosis),
    via_administracion: String(doc.via_administracion),
    frecuencia_horas: asPlainInt(doc.frecuencia_horas),
    duracion_dias: asPlainInt(doc.duracion_dias),
    cantidad: Number(doc.cantidad),
    indicaciones: doc.indicaciones == null ? null : String(doc.indicaciones),
  };
}

function consultaFromDoc(doc: Document): ConsultaDto {
  return {
    id_consulta: asConsultaId(asPlainInt(doc.id_consulta)),
    id_expediente: asPlainInt(doc.id_expediente) as ExpedienteId,
    id_profesional: asPlainInt(doc.id_profesional) as ConsultaDto['id_profesional'],
    id_cita: doc.id_cita == null ? null : asPlainInt(doc.id_cita),
    fecha_hora_inicio: fromBsonDate(doc.fecha_hora_inicio as Date | string),
    fecha_hora_fin: fromBsonDate(doc.fecha_hora_fin as Date | string),
    tipo: doc.tipo as ConsultaDto['tipo'],
    motivo_consulta: String(doc.motivo_consulta),
    enfermedad_actual: doc.enfermedad_actual == null ? null : String(doc.enfermedad_actual),
    exploracion_fisica: doc.exploracion_fisica == null ? null : String(doc.exploracion_fisica),
    plan: doc.plan == null ? null : String(doc.plan),
    estado: doc.estado as ConsultaDto['estado'],
  };
}

function assembleCompleta(doc: Document): ConsultaCompleta {
  const diagnosticos = (Array.isArray(doc.diagnosticos) ? doc.diagnosticos : [])
    .map((row) => diagnosticoFromDoc(row as Document))
    .sort((a, b) => a.id_diagnostico - b.id_diagnostico);
  const tratamientos = (Array.isArray(doc.tratamientos) ? doc.tratamientos : [])
    .map((row) => tratamientoFromDoc(row as Document))
    .sort((a, b) => a.id_tratamiento - b.id_tratamiento);
  const receta = doc.receta == null ? null : recetaFromDoc(doc.receta as Document);
  const detalles = (Array.isArray(doc.detalles) ? doc.detalles : [])
    .map((row) => detalleFromDoc(row as Document))
    .sort((a, b) => a.id_medicamento - b.id_medicamento);
  return {
    consulta: cloneDto(consultaFromDoc(doc)),
    diagnosticos: diagnosticos.map(cloneDto),
    tratamientos: tratamientos.map(cloneDto),
    receta: receta ? cloneDto(receta) : null,
    detalles: detalles.map(cloneDto),
  };
}

export class MongoConsultaRepository implements ConsultaRepositoryPort {
  constructor(
    private readonly db: Db,
    private readonly id_institucion: InstitutionId,
    private readonly ids: IdPort,
    private readonly unitOfWork: UnitOfWorkPort,
    private readonly afterWrite: (point: PersistenceCheckpoint) => void = () => {},
  ) {}

  private institutionFilter(): Document {
    return { institution_id: toBsonInt(this.id_institucion) };
  }

  private async assertProfessionalActive(id_profesional: number, opts: object): Promise<void> {
    const row = await this.db.collection<MongoStringIdDoc>('profesionales').findOne(
      {
        ...this.institutionFilter(),
        id_profesional: toBsonInt(id_profesional),
        activo: true,
      },
      opts,
    );
    if (!row) {
      throw new ClinicalError('reference_not_found', REFERENCE_NOT_FOUND);
    }
  }

  private async assertCie10(codigo: string, opts: object): Promise<void> {
    const row = await this.db.collection<MongoStringIdDoc>('catalogo_cie10').findOne(
      {
        ...this.institutionFilter(),
        codigo_cie10: codigo,
      },
      opts,
    );
    if (!row) {
      throw new ClinicalError('reference_not_found', REFERENCE_NOT_FOUND);
    }
  }

  private async assertMedicationActive(id_medicamento: number, opts: object): Promise<void> {
    const row = await this.db.collection<MongoStringIdDoc>('medicamentos').findOne(
      {
        ...this.institutionFilter(),
        id_medicamento: toBsonInt(id_medicamento),
        activo: true,
      },
      opts,
    );
    if (!row) {
      throw new ClinicalError('reference_not_found', REFERENCE_NOT_FOUND);
    }
  }

  async closeConsulta(bundle: CloseConsultaBundle): Promise<ConsultaCompleta> {
    return this.unitOfWork.runInTransaction(async () => {
      const opts = sessionOpts();
      const expediente = await this.db.collection<MongoStringIdDoc>('expedientes').findOne(
        {
          ...this.institutionFilter(),
          id_expediente: toBsonInt(bundle.consulta.id_expediente),
        },
        opts,
      );
      if (!expediente) {
        throw new ClinicalError('not_found', NOT_FOUND);
      }
      if (String(expediente.estado) === 'archivado') {
        throw new ClinicalError('expediente_archived', EXPEDIENTE_ARCHIVED);
      }

      await this.assertProfessionalActive(bundle.consulta.id_profesional, opts);
      for (const dx of bundle.diagnosticos) {
        if (dx.codigo_cie10 != null && dx.codigo_cie10 !== '') {
          await this.assertCie10(dx.codigo_cie10, opts);
        }
      }
      if (bundle.receta) {
        for (const detalle of bundle.receta.detalles) {
          await this.assertMedicationActive(detalle.id_medicamento, opts);
        }
      }

      const currentRev = asPlainInt(expediente._rev);
      const bumped = await this.db.collection<MongoStringIdDoc>('expedientes').findOneAndUpdate(
        {
          _id: expediente._id,
          institution_id: toBsonInt(this.id_institucion),
          estado: 'activo',
          _rev: expediente._rev,
        },
        { $set: { _rev: toBsonInt(currentRev + 1) } },
        { returnDocument: 'after', ...opts },
      );
      if (!bumped) {
        throw new ClinicalError('expediente_archived', EXPEDIENTE_ARCHIVED);
      }

      const id_consulta = asConsultaId(await this.ids.nextInt('consulta'));
      const consulta: ConsultaDto = {
        id_consulta,
        ...bundle.consulta,
      };

      const diagnosticos: DiagnosticoDto[] = [];
      for (let i = 0; i < bundle.diagnosticos.length; i += 1) {
        const dxInput = bundle.diagnosticos[i]!;
        const id_diagnostico = asDiagnosticoId(await this.ids.nextInt('diagnostico'));
        diagnosticos.push({
          id_diagnostico,
          id_consulta,
          codigo_cie10: dxInput.codigo_cie10,
          descripcion: dxInput.descripcion,
          tipo: dxInput.tipo,
          es_principal: dxInput.es_principal,
          fecha_registro: dxInput.fecha_registro,
        });
      }

      const tratamientos: TratamientoDto[] = [];
      for (const txInput of bundle.tratamientos) {
        const id_diagnostico = diagnosticos[txInput.diagnostico_index]?.id_diagnostico;
        if (id_diagnostico == null) {
          throw new ClinicalError('invalid_bundle', 'Índice de diagnóstico inválido');
        }
        const id_tratamiento = asTratamientoId(await this.ids.nextInt('tratamiento'));
        tratamientos.push({
          id_tratamiento,
          id_diagnostico,
          tipo: txInput.tipo,
          descripcion: txInput.descripcion,
          indicaciones: txInput.indicaciones,
          fecha_inicio: txInput.fecha_inicio,
          fecha_fin_estimada: txInput.fecha_fin_estimada,
          estado: txInput.estado,
        });
      }

      let receta: RecetaDto | null = null;
      let detalles: DetalleRecetaDto[] = [];
      if (bundle.receta) {
        const id_receta = asRecetaId(await this.ids.nextInt('receta'));
        receta = {
          id_receta,
          id_consulta,
          ...bundle.receta.header,
        };
        detalles = bundle.receta.detalles.map((detalleInput) => ({
          id_receta,
          ...detalleInput,
        }));
      }

      // Single insert keeps C5.3 consultas find/insert-only (no UPDATE privilege).
      // afterDiagnostico still runs after a real write so failNext rolls back the txn.
      if (diagnosticos.length === 0) {
        throw new ClinicalError('invalid_bundle', 'Se requiere al menos un diagnóstico');
      }
      if (tratamientos.length === 0) {
        throw new ClinicalError('invalid_bundle', 'Se requiere al menos un tratamiento');
      }

      const _id = makeDocumentId(this.id_institucion, id_consulta);
      await this.db.collection<MongoStringIdDoc>('consultas').insertOne(
        {
          _id,
          institution_id: toBsonInt(this.id_institucion),
          id_consulta: toBsonInt(id_consulta),
          id_expediente: toBsonInt(consulta.id_expediente),
          id_profesional: toBsonInt(consulta.id_profesional),
          id_cita: consulta.id_cita == null ? null : toBsonInt(consulta.id_cita),
          fecha_hora_inicio: toBsonDate(consulta.fecha_hora_inicio),
          fecha_hora_fin: toBsonDate(consulta.fecha_hora_fin ?? consulta.fecha_hora_inicio),
          tipo: consulta.tipo,
          motivo_consulta: consulta.motivo_consulta,
          enfermedad_actual: consulta.enfermedad_actual,
          exploracion_fisica: consulta.exploracion_fisica,
          plan: consulta.plan,
          estado: consulta.estado,
          diagnosticos: diagnosticos.map(diagnosticoToBson),
          tratamientos: tratamientos.map(tratamientoToBson),
          receta: receta ? recetaToBson(receta) : null,
          detalles: detalles.map(detalleToBson),
        },
        opts,
      );
      this.afterWrite('afterConsulta');
      for (let i = 0; i < diagnosticos.length; i += 1) {
        this.afterWrite('afterDiagnostico');
      }

      const stored = await this.db.collection<MongoStringIdDoc>('consultas').findOne({ _id }, opts);
      if (!stored) {
        throw new ClinicalError('not_found', NOT_FOUND);
      }
      return assembleCompleta(stored);
    });
  }

  async findById(id: ConsultaId): Promise<ConsultaDto | null> {
    const doc = await this.db
      .collection<MongoStringIdDoc>('consultas')
      .findOne({ ...this.institutionFilter(), id_consulta: toBsonInt(id) }, sessionOpts());
    return doc ? cloneDto(consultaFromDoc(doc)) : null;
  }

  async listByExpediente(id: ExpedienteId): Promise<ConsultaCompleta[]> {
    const docs = await this.db
      .collection<MongoStringIdDoc>('consultas')
      .find({ ...this.institutionFilter(), id_expediente: toBsonInt(id) }, sessionOpts())
      .sort({ fecha_hora_inicio: -1, id_consulta: -1 })
      .toArray();
    return docs.map((doc) => assembleCompleta(doc));
  }
}

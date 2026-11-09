/**
 * Laboratorio MongoDB: OP-31 close of an open consultation and audited corrections of the
 * diagnoses / treatments / prescription embedded in a `consultas` document. Every statement
 * runs on the caller's session (activeMongoSession, opened by unitOfWork.runInTransaction).
 * Serialization with OP-18 archive: each method bumps the expediente `_rev` inside the
 * transaction (as MongoConsultaRepository.closeConsulta does), so a concurrent archive, which
 * also writes the expediente document, hits a write conflict and one of the two aborts.
 * Clinical documents are never deleted; BITACORA rows go to the append-only `bitacora`.
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
import { asConsultaId } from '@genki/shared';
import type { ClinicalItemDto } from '@genki/shared/full/consultation';
import type { ClientSession, Db, Document } from 'mongodb';
import { ClinicalError } from '../../../domain/clinical-error.js';
import type { ClinicalItemEntity } from '../../../domain/full/clinical-maintenance.js';
import type { IdPort } from '../../../ports/id.js';
import type {
  BitacoraClinicaEntry,
  CierreConsultaBundle,
  ClinicalItemPatch,
  ClinicalItemSnapshot,
  ConsultaParaCierre,
  ConsultationRepositoryPort,
} from '../../../ports/full/consultation.js';
import {
  assembleCompleta,
  consultaFromDoc,
  detalleToBson,
  diagnosticoFromDoc,
  diagnosticoToBson,
  recetaFromDoc,
  recetaToBson,
  tratamientoFromDoc,
  tratamientoToBson,
} from '../consulta-repository.js';
import { asPlainInt, makeDocumentId, toBsonDate, toBsonInt } from '../mapper.js';
import { activeMongoSession } from '../unit-of-work.js';

const NOT_FOUND = 'Recurso no encontrado';
const CONFLICT = 'Conflicto de recurso';
const REFERENCE_NOT_FOUND = 'Referencia de catálogo no encontrada';

export type ClinicalMaintenanceMethods = Pick<
  ConsultationRepositoryPort,
  | 'findConsultaParaCierre'
  | 'guardarCierreConsulta'
  | 'findClinicalItem'
  | 'updateClinicalItem'
  | 'appendBitacora'
>;

/** Embedded path of each clinical item inside a `consultas` document. */
const ITEM_KEY: Record<ClinicalItemEntity, string> = {
  diagnostico: 'diagnosticos.id_diagnostico',
  tratamiento: 'tratamientos.id_tratamiento',
  receta: 'receta.id_receta',
};

function sessionOpts(): { session?: ClientSession } {
  const session = activeMongoSession();
  return session ? { session } : {};
}

function extractItem(doc: Document, entidad: ClinicalItemEntity, id: number): ClinicalItemDto {
  if (entidad === 'diagnostico') {
    const row = (Array.isArray(doc.diagnosticos) ? doc.diagnosticos : []).find(
      (d: Document) => asPlainInt(d.id_diagnostico) === id,
    );
    if (!row) throw new ClinicalError('not_found', NOT_FOUND);
    return { entidad, item: diagnosticoFromDoc(row as Document) };
  }
  if (entidad === 'tratamiento') {
    const row = (Array.isArray(doc.tratamientos) ? doc.tratamientos : []).find(
      (t: Document) => asPlainInt(t.id_tratamiento) === id,
    );
    if (!row) throw new ClinicalError('not_found', NOT_FOUND);
    return { entidad, item: tratamientoFromDoc(row as Document) };
  }
  const receta = doc.receta as Document | null | undefined;
  if (!receta || asPlainInt(receta.id_receta) !== id)
    throw new ClinicalError('not_found', NOT_FOUND);
  return { entidad, item: recetaFromDoc(receta) };
}

export function createMongoClinicalMaintenance(deps: {
  db: Db;
  id_institucion: InstitutionId;
  ids: IdPort;
}): ClinicalMaintenanceMethods {
  const inst = toBsonInt(deps.id_institucion);
  const consultas = () => deps.db.collection<Document>('consultas');

  /** Bumps `_rev` (write lock) on this institution's expediente; returns its state. */
  async function lockExpediente(id_expediente: number): Promise<ExpedienteEstado | null> {
    const bumped = await deps.db
      .collection<Document>('expedientes')
      .findOneAndUpdate(
        { institution_id: inst, id_expediente: toBsonInt(id_expediente) },
        { $inc: { _rev: toBsonInt(1) } },
        { returnDocument: 'after', ...sessionOpts() },
      );
    return bumped ? (String(bumped.estado) as ExpedienteEstado) : null;
  }

  async function lockConsulta(
    id_consulta: number,
  ): Promise<{ doc: Document; expediente_estado: ExpedienteEstado } | null> {
    const doc = await consultas().findOne(
      { institution_id: inst, id_consulta: toBsonInt(id_consulta) },
      sessionOpts(),
    );
    if (!doc) return null;
    const expediente_estado = await lockExpediente(asPlainInt(doc.id_expediente));
    if (!expediente_estado) return null;
    return { doc, expediente_estado };
  }

  async function assertCie10(codigo: string): Promise<void> {
    const row = await deps.db
      .collection<Document>('catalogo_cie10')
      .findOne({ institution_id: inst, codigo_cie10: codigo }, sessionOpts());
    if (!row) throw new ClinicalError('reference_not_found', REFERENCE_NOT_FOUND);
  }

  async function assertMedicationActive(id_medicamento: number): Promise<void> {
    const row = await deps.db
      .collection<Document>('medicamentos')
      .findOne(
        { institution_id: inst, id_medicamento: toBsonInt(id_medicamento), activo: true },
        sessionOpts(),
      );
    if (!row) throw new ClinicalError('reference_not_found', REFERENCE_NOT_FOUND);
  }

  return {
    async findConsultaParaCierre(id_consulta: number): Promise<ConsultaParaCierre | null> {
      const locked = await lockConsulta(id_consulta);
      if (!locked) return null;
      return { consulta: consultaFromDoc(locked.doc), expediente_estado: locked.expediente_estado };
    },

    async guardarCierreConsulta(
      id_consulta: number,
      bundle: CierreConsultaBundle,
    ): Promise<ConsultaCompleta> {
      const locked = await lockConsulta(id_consulta);
      if (!locked) throw new ClinicalError('not_found', NOT_FOUND);
      if (locked.doc.estado !== 'abierta') throw new ClinicalError('conflict', CONFLICT);

      for (const dx of bundle.diagnosticos) {
        if (dx.codigo_cie10 != null && dx.codigo_cie10 !== '') await assertCie10(dx.codigo_cie10);
      }
      if (bundle.receta) {
        for (const detalle of bundle.receta.detalles)
          await assertMedicationActive(detalle.id_medicamento);
      }

      const idConsulta = asConsultaId(id_consulta);
      const diagnosticos: DiagnosticoDto[] = [];
      for (const input of bundle.diagnosticos) {
        diagnosticos.push({
          id_diagnostico: (await deps.ids.nextInt(
            'diagnostico',
          )) as DiagnosticoDto['id_diagnostico'],
          id_consulta: idConsulta,
          codigo_cie10: input.codigo_cie10,
          descripcion: input.descripcion,
          tipo: input.tipo,
          es_principal: input.es_principal,
          fecha_registro: input.fecha_registro,
        });
      }
      const tratamientos: TratamientoDto[] = [];
      for (const input of bundle.tratamientos) {
        const parent = diagnosticos[input.diagnostico_index];
        if (!parent) throw new ClinicalError('invalid_bundle', 'Índice de diagnóstico inválido');
        tratamientos.push({
          id_tratamiento: (await deps.ids.nextInt(
            'tratamiento',
          )) as TratamientoDto['id_tratamiento'],
          id_diagnostico: parent.id_diagnostico,
          tipo: input.tipo,
          descripcion: input.descripcion,
          indicaciones: input.indicaciones,
          fecha_inicio: input.fecha_inicio,
          fecha_fin_estimada: input.fecha_fin_estimada,
          estado: input.estado,
        });
      }
      let receta: RecetaDto | null = null;
      let detalles: DetalleRecetaDto[] = [];
      if (bundle.receta) {
        const id_receta = (await deps.ids.nextInt('receta')) as RecetaDto['id_receta'];
        receta = { id_receta, id_consulta: idConsulta, ...bundle.receta.header };
        detalles = bundle.receta.detalles.map((input) => ({ id_receta, ...input }));
      }

      const set: Document = {
        estado: 'cerrada',
        fecha_hora_fin: toBsonDate(bundle.fecha_hora_fin),
        enfermedad_actual: bundle.enfermedad_actual,
        exploracion_fisica: bundle.exploracion_fisica,
        plan: bundle.plan,
      };
      if (receta) set.receta = recetaToBson(receta);
      // Guarded on estado 'abierta': a concurrent close loses with 409 (never overwrites).
      const result = await consultas().updateOne(
        { _id: locked.doc._id, institution_id: inst, estado: 'abierta' },
        {
          $set: set,
          $push: {
            diagnosticos: { $each: diagnosticos.map(diagnosticoToBson) },
            tratamientos: { $each: tratamientos.map(tratamientoToBson) },
            detalles: { $each: detalles.map(detalleToBson) },
          } as Document,
        },
        sessionOpts(),
      );
      if (result.matchedCount !== 1) throw new ClinicalError('conflict', CONFLICT);

      const stored = await consultas().findOne({ _id: locked.doc._id }, sessionOpts());
      if (!stored) throw new ClinicalError('not_found', NOT_FOUND);
      return assembleCompleta(stored);
    },

    async findClinicalItem(
      entidad: ClinicalItemEntity,
      id: number,
    ): Promise<ClinicalItemSnapshot | null> {
      const doc = await consultas().findOne(
        { institution_id: inst, [ITEM_KEY[entidad]]: toBsonInt(id) },
        sessionOpts(),
      );
      if (!doc) return null; // missing or another institution's item
      const expediente_estado = await lockExpediente(asPlainInt(doc.id_expediente));
      if (!expediente_estado) return null;
      return {
        item: extractItem(doc, entidad, id),
        id_consulta: asPlainInt(doc.id_consulta),
        consulta_estado: String(doc.estado),
        expediente_estado,
      };
    },

    async updateClinicalItem(patch: ClinicalItemPatch): Promise<ClinicalItemDto> {
      const set: Document = {};
      const arrayFilters: Document[] = [];
      if (patch.entidad === 'diagnostico') {
        if (patch.tipo !== undefined) set['diagnosticos.$[it].tipo'] = patch.tipo;
        if (patch.descripcion !== undefined)
          set['diagnosticos.$[it].descripcion'] = patch.descripcion;
        arrayFilters.push({ 'it.id_diagnostico': toBsonInt(patch.id) });
      } else if (patch.entidad === 'tratamiento') {
        if (patch.estado !== undefined) set['tratamientos.$[it].estado'] = patch.estado;
        if (patch.indicaciones !== undefined)
          set['tratamientos.$[it].indicaciones'] = patch.indicaciones;
        if (patch.fecha_fin_estimada !== undefined)
          set['tratamientos.$[it].fecha_fin_estimada'] =
            patch.fecha_fin_estimada == null ? null : patch.fecha_fin_estimada.slice(0, 10);
        arrayFilters.push({ 'it.id_tratamiento': toBsonInt(patch.id) });
      } else {
        if (patch.estado !== undefined) set['receta.estado'] = patch.estado;
        if (patch.observaciones !== undefined) set['receta.observaciones'] = patch.observaciones;
      }
      if (Object.keys(set).length === 0)
        throw new ClinicalError('invalid_body', 'Solicitud inválida');
      const filter = { institution_id: inst, [ITEM_KEY[patch.entidad]]: toBsonInt(patch.id) };
      const result = await consultas().updateOne(
        filter,
        { $set: set },
        { ...(arrayFilters.length > 0 ? { arrayFilters } : {}), ...sessionOpts() },
      );
      if (result.matchedCount !== 1) throw new ClinicalError('not_found', NOT_FOUND);
      const doc = await consultas().findOne(filter, sessionOpts());
      if (!doc) throw new ClinicalError('not_found', NOT_FOUND);
      return extractItem(doc, patch.entidad, patch.id);
    },

    async appendBitacora(entry: BitacoraClinicaEntry): Promise<void> {
      // Same transaction (session) as the clinical change: both commit or neither does.
      const id_bitacora = await deps.ids.nextInt('bitacora');
      await deps.db.collection<Document>('bitacora').insertOne(
        {
          _id: makeDocumentId(deps.id_institucion, id_bitacora),
          institution_id: inst,
          id_bitacora: toBsonInt(id_bitacora),
          id_usuario: toBsonInt(entry.id_usuario),
          entidad: entry.entidad,
          id_registro: entry.id_registro,
          accion: entry.accion,
          fecha_hora: toBsonDate(entry.fecha_hora),
          direccion_ip: null,
          detalle: entry.detalle,
        } as Document,
        sessionOpts(),
      );
    },
  };
}

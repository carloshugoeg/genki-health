import type { InstitutionId } from '@genki/shared';
import type { LabHistory, Page, RESULTADO, ResultadoFlags } from '@genki/shared/full/lab-results';
import type { MUESTRA, ORDEN_EXAMEN } from '@genki/shared/full/schema';
import type { Db, Document, FindOptions, InsertOneOptions } from 'mongodb';
import { ClinicalError } from '../../../domain/clinical-error.js';
import type { ClockPort } from '../../../ports/clock.js';
import type { IdPort } from '../../../ports/id.js';
import type { UnitOfWorkPort } from '../../../ports/unit-of-work.js';
import type { OperationContext } from '../../../ports/full/context.js';
import type {
  LabResultsRepositoryPort,
  Op50Request,
  Op50Response,
  Op51Request,
  Op51Response,
  Op52Request,
  Op52Response,
  Op53Request,
  Op53Response,
  Op54Request,
  Op54Response,
} from '../../../ports/full/lab-results.js';
import { makeDocumentId, toBsonInt } from '../mapper.js';
import { activeMongoSession } from '../unit-of-work.js';

const NOT_FOUND = 'Recurso no encontrado';
const CONFLICT = 'Conflicto de recurso';

function sessionOpts():
  | Pick<FindOptions, 'session'>
  | Pick<InsertOneOptions, 'session'>
  | Record<string, never> {
  const session = activeMongoSession();
  return session ? { session } : {};
}

function mapOrden(doc: Record<string, unknown>): ORDEN_EXAMEN {
  return {
    id_orden: Number(doc.id_orden),
    id_paciente: Number(doc.id_paciente),
    institucion_origen: Number(doc.institucion_origen),
    medico_solicitante: String(doc.medico_solicitante),
    fecha_solicitud: String(doc.fecha_solicitud),
    prioridad: String(doc.prioridad),
    estado: String(doc.estado),
    ...(doc.observaciones != null ? { observaciones: String(doc.observaciones) } : {}),
    ...(doc.referencia_externa != null
      ? { referencia_externa: String(doc.referencia_externa) }
      : {}),
  };
}

export function createMongoLabResultsRepository(deps: {
  db: Db;
  id_institucion: InstitutionId;
  ids: IdPort;
  unitOfWork: UnitOfWorkPort;
  clock: ClockPort;
}): LabResultsRepositoryPort {
  const inst = toBsonInt(deps.id_institucion);

  return {
    async op50(input: Op50Request, context: OperationContext): Promise<Op50Response> {
      return deps.unitOfWork.runInTransaction(async () => {
        const opts = sessionOpts();
        const orden = await deps.db
          .collection('ordenes_examen')
          .findOne({ institution_id: inst, id_orden: toBsonInt(input.params.id) }, opts);
        if (!orden) throw new ClinicalError('not_found', NOT_FOUND);
        const muestra = await deps.db.collection('muestras').findOne(
          {
            institution_id: inst,
            id_muestra: toBsonInt(input.body.id_muestra),
            id_orden: toBsonInt(input.params.id),
          },
          opts,
        );
        if (!muestra) throw new ClinicalError('not_found', NOT_FOUND);
        const id_resultado = await deps.ids.nextInt('resultado');
        const row: RESULTADO = {
          id_resultado,
          id_orden: input.params.id,
          codigo_examen: input.body.codigo_examen,
          id_muestra: input.body.id_muestra,
          fecha_hora_resultado: context.now || deps.clock.nowIso(),
          datos: input.body.datos as RESULTADO['datos'],
          estado: 'registrado',
          ...(input.body.observaciones !== undefined
            ? { observaciones: input.body.observaciones }
            : {}),
        };
        await deps.db.collection<Document>('resultados').insertOne(
          {
            _id: makeDocumentId(deps.id_institucion, id_resultado) as unknown as Document['_id'],
            institution_id: inst,
            ...row,
            id_resultado: toBsonInt(id_resultado),
            id_orden: toBsonInt(row.id_orden),
            id_muestra: toBsonInt(row.id_muestra),
          },
          opts,
        );
        return row;
      });
    },

    async op51(input: Op51Request, context: OperationContext): Promise<Op51Response> {
      return deps.unitOfWork.runInTransaction(async () => {
        const opts = sessionOpts();
        const doc = await deps.db
          .collection('resultados')
          .findOne({ institution_id: inst, id_resultado: toBsonInt(input.params.id) }, opts);
        if (!doc) throw new ClinicalError('not_found', NOT_FOUND);
        if (doc.estado !== 'registrado') throw new ClinicalError('conflict', CONFLICT);
        const fecha = context.now || deps.clock.nowIso();
        await deps.db.collection('resultados').updateOne(
          { institution_id: inst, id_resultado: toBsonInt(input.params.id) },
          {
            $set: {
              estado: 'validado',
              validado_por: context.id_profesional,
              fecha_validacion: fecha,
            },
          },
          opts,
        );
        return {
          id_resultado: Number(doc.id_resultado),
          id_orden: Number(doc.id_orden),
          codigo_examen: String(doc.codigo_examen),
          id_muestra: Number(doc.id_muestra),
          fecha_hora_resultado: String(doc.fecha_hora_resultado),
          datos: doc.datos as RESULTADO['datos'],
          estado: 'validado',
          validado_por: context.id_profesional,
          fecha_validacion: fecha,
          ...(doc.observaciones != null ? { observaciones: String(doc.observaciones) } : {}),
        };
      });
    },

    async op52(input: Op52Request, _context: OperationContext): Promise<Op52Response> {
      return deps.unitOfWork.runInTransaction(async () => {
        const doc = await deps.db
          .collection('resultados')
          .findOne(
            { institution_id: inst, id_resultado: toBsonInt(input.params.id) },
            sessionOpts(),
          );
        if (!doc) throw new ClinicalError('not_found', NOT_FOUND);
        const flags: ResultadoFlags = {
          id_resultado: Number(doc.id_resultado),
          analitos: [],
        };
        const datos = doc.datos;
        if (datos && typeof datos === 'object' && !Array.isArray(datos) && 'analitos' in datos) {
          const list = (datos as { analitos?: unknown }).analitos;
          if (Array.isArray(list)) {
            for (const item of list) {
              if (!item || typeof item !== 'object') continue;
              const a = item as Record<string, unknown>;
              const valor = Number(a.valor);
              const min = Number(a.min ?? 0);
              const max = Number(a.max ?? 0);
              flags.analitos.push({
                nombre: String(a.nombre ?? ''),
                valor,
                unidad: String(a.unidad ?? ''),
                min,
                max,
                fuera_rango: valor < min || valor > max,
                referencia_version: String(a.referencia_version ?? 'none'),
              });
            }
          }
        }
        return flags;
      });
    },

    async op53(input: Op53Request, _context: OperationContext): Promise<Op53Response> {
      return deps.unitOfWork.runInTransaction(async () => {
        const opts = sessionOpts();
        const doc = await deps.db
          .collection('ordenes_examen')
          .findOne({ institution_id: inst, id_orden: toBsonInt(input.params.id) }, opts);
        if (!doc) throw new ClinicalError('not_found', NOT_FOUND);
        await deps.db
          .collection('ordenes_examen')
          .updateOne(
            { institution_id: inst, id_orden: toBsonInt(input.params.id) },
            { $set: { estado: 'entregada' } },
            opts,
          );
        return { ...mapOrden(doc as Record<string, unknown>), estado: 'entregada' };
      });
    },

    async op54(input: Op54Request, _context: OperationContext): Promise<Op54Response> {
      return deps.unitOfWork.runInTransaction(async () => {
        const opts = sessionOpts();
        const page = input.query.page ?? 1;
        const page_size = input.query.page_size ?? 20;
        const ordenes = await deps.db
          .collection('ordenes_examen')
          .find({ institution_id: inst, id_paciente: toBsonInt(input.params.id) }, opts)
          .sort({ id_orden: 1 })
          .toArray();
        const items: LabHistory[] = [];
        for (const doc of ordenes) {
          const orden = mapOrden(doc as Record<string, unknown>);
          const muestras = (await deps.db
            .collection('muestras')
            .find({ institution_id: inst, id_orden: toBsonInt(orden.id_orden) }, opts)
            .toArray()) as unknown as MUESTRA[];
          const resultados = (await deps.db
            .collection('resultados')
            .find({ institution_id: inst, id_orden: toBsonInt(orden.id_orden) }, opts)
            .toArray()) as unknown as RESULTADO[];
          items.push({
            orden,
            muestras: muestras.map((m) => ({
              id_muestra: Number(m.id_muestra),
              id_orden: Number(m.id_orden),
              codigo_barras: String(m.codigo_barras),
              tipo_muestra: String(m.tipo_muestra),
              fecha_hora_toma: String(m.fecha_hora_toma),
              condicion: String(m.condicion),
              responsable_toma: Number(m.responsable_toma),
            })),
            resultados: resultados.map((r) => ({
              id_resultado: Number(r.id_resultado),
              id_orden: Number(r.id_orden),
              codigo_examen: String(r.codigo_examen),
              id_muestra: Number(r.id_muestra),
              fecha_hora_resultado: String(r.fecha_hora_resultado),
              datos: r.datos as RESULTADO['datos'],
              estado: String(r.estado),
            })),
          });
        }
        const start = (page - 1) * page_size;
        const out: Page<LabHistory> = {
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

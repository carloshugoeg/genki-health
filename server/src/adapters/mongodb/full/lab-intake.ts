import type { InstitutionId } from '@genki/shared';
import type { ORDEN_EXAMEN, MUESTRA } from '@genki/shared/full/lab-intake';
import type { Db, Document, FindOptions, InsertOneOptions } from 'mongodb';
import { ClinicalError } from '../../../domain/clinical-error.js';
import type { ClockPort } from '../../../ports/clock.js';
import type { IdPort } from '../../../ports/id.js';
import type { UnitOfWorkPort } from '../../../ports/unit-of-work.js';
import type { OperationContext } from '../../../ports/full/context.js';
import type {
  LabIntakeRepositoryPort,
  Op48Request,
  Op48Response,
  Op49Request,
  Op49Response,
} from '../../../ports/full/lab-intake.js';
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

export function createMongoLabIntakeRepository(deps: {
  db: Db;
  id_institucion: InstitutionId;
  ids: IdPort;
  unitOfWork: UnitOfWorkPort;
  clock: ClockPort;
}): LabIntakeRepositoryPort {
  const inst = toBsonInt(deps.id_institucion);

  return {
    async op48(input: Op48Request, context: OperationContext): Promise<Op48Response> {
      return deps.unitOfWork.runInTransaction(async () => {
        const id_orden = await deps.ids.nextInt('orden_examen');
        const orden: ORDEN_EXAMEN = {
          id_orden,
          id_paciente: input.body.id_paciente,
          institucion_origen: input.body.institucion_origen,
          medico_solicitante: input.body.medico_solicitante,
          fecha_solicitud: context.now || deps.clock.nowIso(),
          prioridad: input.body.prioridad,
          estado: 'recibida',
          ...(input.body.observaciones !== undefined
            ? { observaciones: input.body.observaciones }
            : {}),
          ...(input.body.referencia_externa !== undefined
            ? { referencia_externa: input.body.referencia_externa }
            : {}),
        };
        await deps.db.collection<Document>('ordenes_examen').insertOne(
          {
            _id: makeDocumentId(deps.id_institucion, id_orden) as unknown as Document['_id'],
            institution_id: inst,
            ...orden,
            id_orden: toBsonInt(id_orden),
            id_paciente: toBsonInt(orden.id_paciente),
            institucion_origen: toBsonInt(orden.institucion_origen),
            examenes: input.body.examenes,
          },
          sessionOpts(),
        );
        return orden;
      });
    },

    async op49(input: Op49Request, _context: OperationContext): Promise<Op49Response> {
      return deps.unitOfWork.runInTransaction(async () => {
        const opts = sessionOpts();
        const ordenDoc = await deps.db.collection('ordenes_examen').findOne(
          { institution_id: inst, id_orden: toBsonInt(input.params.id) },
          opts,
        );
        if (!ordenDoc) throw new ClinicalError('not_found', NOT_FOUND);
        if (ordenDoc.estado === 'entregada' || ordenDoc.estado === 'anulada') {
          throw new ClinicalError('conflict', CONFLICT);
        }
        const id_muestra = await deps.ids.nextInt('muestra');
        const muestra: MUESTRA = {
          id_muestra,
          id_orden: input.params.id,
          ...input.body,
        };
        await deps.db.collection<Document>('muestras').insertOne(
          {
            _id: makeDocumentId(deps.id_institucion, id_muestra) as unknown as Document['_id'],
            institution_id: inst,
            ...muestra,
            id_muestra: toBsonInt(id_muestra),
            id_orden: toBsonInt(input.params.id),
            responsable_toma: toBsonInt(input.body.responsable_toma),
          },
          opts,
        );
        await deps.db.collection('ordenes_examen').updateOne(
          { institution_id: inst, id_orden: toBsonInt(input.params.id) },
          { $set: { estado: 'en_proceso' } },
          opts,
        );
        return muestra;
      });
    },
  };
}

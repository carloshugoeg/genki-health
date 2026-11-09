import type { ORDEN_EXAMEN, MUESTRA } from '@genki/shared/full/lab-intake';
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
import { getExtensionNamespace } from '../full-state.js';
import type { MemoryInstitutionState } from '../state.js';
import { activeMemoryMaps } from '../unit-of-work.js';

const NOT_FOUND = 'Recurso no encontrado';
const CONFLICT = 'Conflicto de recurso';

export function createMemoryLabIntakeRepository(deps: {
  state: MemoryInstitutionState;
  ids: IdPort;
  unitOfWork: UnitOfWorkPort;
  clock: ClockPort;
}): LabIntakeRepositoryPort {
  return {
    async op48(input: Op48Request, context: OperationContext): Promise<Op48Response> {
      return deps.unitOfWork.runInTransaction(async () => {
        const ns = getExtensionNamespace(activeMemoryMaps(deps.state), 'lab-intake');
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
        if (!ns.has('orden')) ns.set('orden', new Map());
        ns.get('orden')!.set(id_orden, { ...orden, examenes: input.body.examenes });
        return structuredClone(orden);
      });
    },

    async op49(input: Op49Request, _context: OperationContext): Promise<Op49Response> {
      return deps.unitOfWork.runInTransaction(async () => {
        const ns = getExtensionNamespace(activeMemoryMaps(deps.state), 'lab-intake');
        const orden = ns.get('orden')?.get(input.params.id) as ORDEN_EXAMEN | undefined;
        if (!orden) throw new ClinicalError('not_found', NOT_FOUND);
        if (orden.estado === 'entregada' || orden.estado === 'anulada') {
          throw new ClinicalError('conflict', CONFLICT);
        }
        const id_muestra = await deps.ids.nextInt('muestra');
        const muestra: MUESTRA = {
          id_muestra,
          id_orden: orden.id_orden,
          ...input.body,
        };
        if (!ns.has('muestra')) ns.set('muestra', new Map());
        ns.get('muestra')!.set(id_muestra, muestra);
        ns.get('orden')!.set(orden.id_orden, { ...orden, estado: 'en_proceso' });
        return structuredClone(muestra);
      });
    },
  };
}

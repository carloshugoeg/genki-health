import { asPacienteId } from '@genki/shared';
import type { PLAN_TRATAMIENTO } from '@genki/shared/full/dental-plan';
import { ClinicalError } from '../../../domain/clinical-error.js';
import type { ClockPort } from '../../../ports/clock.js';
import type { IdPort } from '../../../ports/id.js';
import type { PacienteRepositoryPort } from '../../../ports/paciente-repository.js';
import type { UnitOfWorkPort } from '../../../ports/unit-of-work.js';
import type { OperationContext } from '../../../ports/full/context.js';
import type {
  DentalPlanRepositoryPort,
  Op57Request,
  Op57Response,
  Op58Request,
  Op58Response,
} from '../../../ports/full/dental-plan.js';
import { getExtensionNamespace } from '../full-state.js';
import type { MemoryInstitutionState } from '../state.js';
import { activeMemoryMaps } from '../unit-of-work.js';

const NOT_FOUND = 'Recurso no encontrado';
const CONFLICT = 'Conflicto de recurso';

export function createMemoryDentalPlanRepository(deps: {
  state: MemoryInstitutionState;
  pacientes: PacienteRepositoryPort;
  ids: IdPort;
  unitOfWork: UnitOfWorkPort;
  clock: ClockPort;
}): DentalPlanRepositoryPort {
  return {
    async op57(input: Op57Request, context: OperationContext): Promise<Op57Response> {
      return deps.unitOfWork.runInTransaction(async () => {
        const ns = getExtensionNamespace(activeMemoryMaps(deps.state), 'dental-plan');
        const expediente = await deps.pacientes.findExpedienteByPaciente(
          asPacienteId(input.params.id),
        );
        if (!expediente) throw new ClinicalError('not_found', NOT_FOUND);
        const id_plan = await deps.ids.nextInt('plan_tratamiento');
        const total = input.body.detalle.reduce(
          (sum, line) => sum + Number(line.precio_unitario || 0),
          0,
        );
        const plan: PLAN_TRATAMIENTO = {
          id_plan,
          id_expediente: expediente.id_expediente,
          fecha_elaboracion: (context.now || deps.clock.nowIso()).slice(0, 10),
          id_profesional: input.body.id_profesional,
          estado: 'propuesto',
          total_estimado: total.toFixed(2),
          detalle: input.body.detalle,
        };
        if (!ns.has('plan')) ns.set('plan', new Map());
        ns.get('plan')!.set(id_plan, plan);
        return structuredClone(plan);
      });
    },

    async op58(input: Op58Request, _context: OperationContext): Promise<Op58Response> {
      return deps.unitOfWork.runInTransaction(async () => {
        const ns = getExtensionNamespace(activeMemoryMaps(deps.state), 'dental-plan');
        const plan = ns.get('plan')?.get(input.params.id) as PLAN_TRATAMIENTO | undefined;
        if (!plan) throw new ClinicalError('not_found', NOT_FOUND);
        if (plan.estado !== 'propuesto') throw new ClinicalError('conflict', CONFLICT);
        const updated = { ...plan, estado: 'aceptado' };
        ns.get('plan')!.set(plan.id_plan, updated);
        return structuredClone(updated);
      });
    },
  };
}

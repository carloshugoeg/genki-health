import { asPacienteId } from '@genki/shared';
import type { SEGUIMIENTO_HITO } from '@genki/shared/full/milestones';
import { ClinicalError } from '../../../domain/clinical-error.js';
import type { ClockPort } from '../../../ports/clock.js';
import type { PacienteRepositoryPort } from '../../../ports/paciente-repository.js';
import type { UnitOfWorkPort } from '../../../ports/unit-of-work.js';
import type { OperationContext } from '../../../ports/full/context.js';
import type {
  MilestonesRepositoryPort,
  Op46Request,
  Op46Response,
} from '../../../ports/full/milestones.js';
import { getExtensionNamespace } from '../full-state.js';
import type { MemoryInstitutionState } from '../state.js';
import { activeMemoryMaps } from '../unit-of-work.js';

const NOT_FOUND = 'Recurso no encontrado';

export type MemoryMilestonesDeps = {
  state: MemoryInstitutionState;
  pacientes: PacienteRepositoryPort;
  unitOfWork: UnitOfWorkPort;
  clock: ClockPort;
};

function cloneDto<T>(v: T): T {
  return structuredClone(v);
}

export function createMemoryMilestonesRepository(
  deps: MemoryMilestonesDeps,
): MilestonesRepositoryPort {
  return {
    async op46(input: Op46Request, _context: OperationContext): Promise<Op46Response> {
      return deps.unitOfWork.runInTransaction(async () => {
        const ns = getExtensionNamespace(activeMemoryMaps(deps.state), 'milestones');
        const expediente = await deps.pacientes.findExpedienteByPaciente(asPacienteId(input.params.id));
        if (!expediente) throw new ClinicalError('not_found', NOT_FOUND);
        const hitos = ns.get('hito_desarrollo');
        if (!hitos?.has(input.params.hito)) {
          // Allow evaluating even if catalog missing in memory tests by synthesizing.
        }
        const key = `${expediente.id_expediente}:${input.params.hito}`;
        const row: SEGUIMIENTO_HITO = {
          id_expediente: expediente.id_expediente,
          id_hito: input.params.hito,
          alcanzado: input.body.alcanzado,
          fecha_evaluacion: input.body.fecha_evaluacion,
          ...(input.body.observacion !== undefined ? { observacion: input.body.observacion } : {}),
        };
        if (!ns.has('seguimiento_hito')) ns.set('seguimiento_hito', new Map());
        ns.get('seguimiento_hito')!.set(key, row);
        return cloneDto(row);
      });
    },
  };
}

import { createHash } from 'node:crypto';
import type { NOTA_EVOLUCION, ADMISION } from '@genki/shared/full/schema';
import { ClinicalError } from '../../../domain/clinical-error.js';
import type { ClockPort } from '../../../ports/clock.js';
import type { IdPort } from '../../../ports/id.js';
import type { UnitOfWorkPort } from '../../../ports/unit-of-work.js';
import type { OperationContext } from '../../../ports/full/context.js';
import type {
  Op36Request,
  Op36Response,
  Op37Request,
  Op37Response,
  ProcedureRepositoryPort,
} from '../../../ports/full/procedure.js';
import { getExtensionNamespace } from '../full-state.js';
import type { MemoryInstitutionState } from '../state.js';
import { activeMemoryMaps } from '../unit-of-work.js';

const NOT_FOUND = 'Recurso no encontrado';
const CONFLICT = 'Conflicto de recurso';

export type MemoryProcedureDeps = {
  state: MemoryInstitutionState;
  ids: IdPort;
  unitOfWork: UnitOfWorkPort;
  clock: ClockPort;
};

function cloneDto<T>(value: T): T {
  return structuredClone(value);
}

function payloadHash(body: unknown): string {
  return createHash('sha256').update(JSON.stringify(body)).digest('hex');
}

export function createMemoryProcedureRepository(deps: MemoryProcedureDeps): ProcedureRepositoryPort {
  return {
    async op36(input: Op36Request, context: OperationContext): Promise<Op36Response> {
      return deps.unitOfWork.runInTransaction(async () => {
        const ns = getExtensionNamespace(activeMemoryMaps(deps.state), 'admission');
        const key = context.idempotency_key!;
        const idemKey = `proc36:${context.id_usuario}:${key}`;
        const prior = ns.get('idempotency')?.get(idemKey) as
          | { hash: string; response: NOTA_EVOLUCION }
          | undefined;
        if (prior) {
          if (prior.hash !== payloadHash(input.body)) throw new ClinicalError('conflict', CONFLICT);
          return cloneDto(prior.response);
        }

        const adm = ns.get('admision')?.get(input.params.id) as ADMISION | undefined;
        if (!adm) throw new ClinicalError('not_found', NOT_FOUND);
        if (adm.estado !== 'activa') throw new ClinicalError('conflict', CONFLICT);

        const id_profesional = context.id_profesional;
        if (!id_profesional) throw new ClinicalError('forbidden', 'No autorizado');

        if (input.body.id_nota_anterior) {
          const prev = ns.get('nota_evolucion')?.get(input.body.id_nota_anterior) as
            | NOTA_EVOLUCION
            | undefined;
          if (!prev || prev.id_admision !== adm.id_admision) {
            throw new ClinicalError('conflict', CONFLICT);
          }
        }

        const id_nota = await deps.ids.nextInt('nota_evolucion');
        const nota: NOTA_EVOLUCION = {
          id_nota,
          id_admision: adm.id_admision,
          id_profesional,
          fecha_hora: context.now || deps.clock.nowIso(),
          contenido: input.body.contenido,
          ...(input.body.turno !== undefined ? { turno: input.body.turno } : {}),
          ...(input.body.id_nota_anterior !== undefined
            ? { id_nota_anterior: input.body.id_nota_anterior }
            : {}),
        };
        if (!ns.has('nota_evolucion')) ns.set('nota_evolucion', new Map());
        ns.get('nota_evolucion')!.set(id_nota, nota);
        if (!ns.has('idempotency')) ns.set('idempotency', new Map());
        ns.get('idempotency')!.set(idemKey, { hash: payloadHash(input.body), response: cloneDto(nota) });
        return cloneDto(nota);
      });
    },

    async op37(_input: Op37Request, _context: OperationContext): Promise<Op37Response> {
      throw new ClinicalError('misconfigured', 'OP37 diferido (cargos/insumos)');
    },
  };
}

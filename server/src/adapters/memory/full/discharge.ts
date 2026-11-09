import { createHash } from 'node:crypto';
import type { ADMISION, CAMA } from '@genki/shared/full/schema';
import { ClinicalError } from '../../../domain/clinical-error.js';
import type { ClockPort } from '../../../ports/clock.js';
import type { UnitOfWorkPort } from '../../../ports/unit-of-work.js';
import type { OperationContext } from '../../../ports/full/context.js';
import type {
  DischargeRepositoryPort,
  Op38Request,
  Op38Response,
} from '../../../ports/full/discharge.js';
import { getExtensionNamespace } from '../full-state.js';
import type { MemoryInstitutionState } from '../state.js';
import { activeMemoryMaps } from '../unit-of-work.js';

const NOT_FOUND = 'Recurso no encontrado';
const CONFLICT = 'Conflicto de recurso';

export type MemoryDischargeDeps = {
  state: MemoryInstitutionState;
  unitOfWork: UnitOfWorkPort;
  clock: ClockPort;
};

function cloneDto<T>(value: T): T {
  return structuredClone(value);
}

function payloadHash(body: unknown): string {
  return createHash('sha256').update(JSON.stringify(body)).digest('hex');
}

export function createMemoryDischargeRepository(
  deps: MemoryDischargeDeps,
): DischargeRepositoryPort {
  return {
    async op38(input: Op38Request, context: OperationContext): Promise<Op38Response> {
      return deps.unitOfWork.runInTransaction(async () => {
        const ns = getExtensionNamespace(activeMemoryMaps(deps.state), 'admission');
        const key = context.idempotency_key!;
        const idemKey = `dis38:${context.id_usuario}:${key}`;
        const prior = ns.get('idempotency')?.get(idemKey) as
          { hash: string; response: ADMISION } | undefined;
        if (prior) {
          if (prior.hash !== payloadHash(input.body)) throw new ClinicalError('conflict', CONFLICT);
          return cloneDto(prior.response);
        }

        const adm = ns.get('admision')?.get(input.params.id) as ADMISION | undefined;
        if (!adm) throw new ClinicalError('not_found', NOT_FOUND);
        if (adm.estado !== 'activa') throw new ClinicalError('conflict', CONFLICT);
        if (input.body.fecha_hora_egreso <= adm.fecha_hora_ingreso) {
          throw new ClinicalError('conflict', CONFLICT);
        }

        const closed: ADMISION = {
          ...adm,
          estado: 'cerrada',
          fecha_hora_egreso: input.body.fecha_hora_egreso,
          id_diagnostico_egreso: input.body.id_diagnostico_egreso,
          condicion_egreso: input.body.condicion_egreso,
        };
        ns.get('admision')!.set(adm.id_admision, closed);
        const bed = ns.get('cama')?.get(adm.id_cama) as CAMA | undefined;
        if (bed) ns.get('cama')!.set(bed.id_cama, { ...bed, estado: 'libre' });
        if (!ns.has('idempotency')) ns.set('idempotency', new Map());
        ns.get('idempotency')!.set(idemKey, {
          hash: payloadHash(input.body),
          response: cloneDto(closed),
        });
        return cloneDto(closed);
      });
    },
  };
}

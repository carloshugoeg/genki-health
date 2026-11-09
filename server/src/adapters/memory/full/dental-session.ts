import { createHash } from 'node:crypto';
import type { PLAN_TRATAMIENTO } from '@genki/shared/full/schema';
import type { SESION_TRATAMIENTO } from '@genki/shared/full/dental-session';
import { ClinicalError } from '../../../domain/clinical-error.js';
import type { ClockPort } from '../../../ports/clock.js';
import type { IdPort } from '../../../ports/id.js';
import type { UnitOfWorkPort } from '../../../ports/unit-of-work.js';
import type { OperationContext } from '../../../ports/full/context.js';
import type {
  DentalSessionRepositoryPort,
  Op59Request,
  Op59Response,
  Op60Request,
  Op60Response,
} from '../../../ports/full/dental-session.js';
import { getExtensionNamespace } from '../full-state.js';
import type { MemoryInstitutionState } from '../state.js';
import { activeMemoryMaps } from '../unit-of-work.js';

const NOT_FOUND = 'Recurso no encontrado';
const CONFLICT = 'Conflicto de recurso';

type PlanLine = {
  linea: number;
  precio_unitario: string;
  realizado?: boolean;
};

type PlanDoc = Omit<PLAN_TRATAMIENTO, 'detalle'> & {
  revision?: number;
  detalle: PlanLine[];
};

function cloneDto<T>(value: T): T {
  return structuredClone(value);
}

function payloadHash(body: unknown): string {
  return createHash('sha256').update(JSON.stringify(body)).digest('hex');
}

function money(n: number): string {
  return n.toFixed(2);
}

export function createMemoryDentalSessionRepository(deps: {
  state: MemoryInstitutionState;
  ids: IdPort;
  unitOfWork: UnitOfWorkPort;
  clock: ClockPort;
}): DentalSessionRepositoryPort {
  return {
    async op59(input: Op59Request, context: OperationContext): Promise<Op59Response> {
      return deps.unitOfWork.runInTransaction(async () => {
        const dental = getExtensionNamespace(activeMemoryMaps(deps.state), 'dental-plan');
        const sessionNs = getExtensionNamespace(activeMemoryMaps(deps.state), 'dental-session');
        const idemKey = `sesion59:${context.id_usuario}:${context.idempotency_key}`;
        const prior = sessionNs.get('idempotency')?.get(idemKey) as
          | { hash: string; response: SESION_TRATAMIENTO }
          | undefined;
        if (prior) {
          if (prior.hash !== payloadHash(input.body)) throw new ClinicalError('conflict', CONFLICT);
          return cloneDto(prior.response);
        }

        const plan = dental.get('plan')?.get(input.params.id) as PlanDoc | undefined;
        if (!plan) throw new ClinicalError('not_found', NOT_FOUND);
        if (plan.estado === 'finalizado') throw new ClinicalError('conflict', CONFLICT);
        const revision = plan.revision ?? 0;
        if (revision !== input.body.expected_revision) {
          throw new ClinicalError('conflict', CONFLICT);
        }

        const lines = Array.isArray(plan.detalle) ? [...plan.detalle] : [];
        for (const linea of input.body.lineas) {
          const row = lines.find((l) => l.linea === linea);
          if (!row) throw new ClinicalError('conflict', CONFLICT);
          if (row.realizado) throw new ClinicalError('conflict', CONFLICT);
          row.realizado = true;
        }

        const ejecutado = lines
          .filter((l) => l.realizado)
          .reduce((sum, l) => sum + Number(l.precio_unitario || 0), 0);
        const presupuesto = Number(plan.total_estimado || 0);
        const allDone = lines.length > 0 && lines.every((l) => l.realizado);
        const nextEstado = allDone
          ? 'finalizado'
          : plan.estado === 'propuesto'
            ? 'en_proceso'
            : plan.estado;
        const updated: PlanDoc = {
          ...plan,
          detalle: lines,
          estado: nextEstado,
          revision: revision + 1,
        };
        dental.get('plan')!.set(plan.id_plan, updated);

        const id_sesion = await deps.ids.nextInt('sesion_tratamiento');
        const session: SESION_TRATAMIENTO = {
          id_sesion,
          id_plan: plan.id_plan,
          fecha: input.body.fecha,
          procedimientos_realizados: input.body.lineas,
          saldo_pendiente: money(Math.max(0, presupuesto - ejecutado)),
          ...(input.body.id_cita != null ? { id_cita: input.body.id_cita } : {}),
          ...(input.body.anestesia_utilizada !== undefined
            ? { anestesia_utilizada: input.body.anestesia_utilizada }
            : {}),
          ...(input.body.observaciones !== undefined
            ? { observaciones: input.body.observaciones }
            : {}),
        };
        if (!sessionNs.has('sesiones')) sessionNs.set('sesiones', new Map());
        sessionNs.get('sesiones')!.set(id_sesion, session);
        if (!sessionNs.has('idempotency')) sessionNs.set('idempotency', new Map());
        sessionNs.get('idempotency')!.set(idemKey, {
          hash: payloadHash(input.body),
          response: cloneDto(session),
        });
        return cloneDto(session);
      });
    },

    async op60(input: Op60Request, _context: OperationContext): Promise<Op60Response> {
      return deps.unitOfWork.runInTransaction(async () => {
        const dental = getExtensionNamespace(activeMemoryMaps(deps.state), 'dental-plan');
        const plans = [...(dental.get('plan')?.values() ?? [])] as PlanDoc[];
        if (plans.length === 0) {
          throw new ClinicalError('not_found', NOT_FOUND);
        }
        void input.params.id;
        let presupuesto = 0;
        let ejecutado = 0;
        for (const plan of plans) {
          presupuesto += Number(plan.total_estimado || 0);
          const lines = Array.isArray(plan.detalle) ? plan.detalle : [];
          ejecutado += lines
            .filter((l) => l.realizado)
            .reduce((sum, l) => sum + Number(l.precio_unitario || 0), 0);
        }
        const facturado = ejecutado;
        const pagado = 0;
        const pendiente = Math.max(0, facturado - pagado);
        return {
          presupuesto: money(presupuesto),
          ejecutado: money(ejecutado),
          facturado: money(facturado),
          pagado: money(pagado),
          pendiente: money(pendiente),
        };
      });
    },
  };
}

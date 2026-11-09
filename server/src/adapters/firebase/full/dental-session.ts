import { asPacienteId, type InstitutionId } from '@genki/shared';
import type { PLAN_TRATAMIENTO } from '@genki/shared/full/dental-plan';
import type { SESION_TRATAMIENTO } from '@genki/shared/full/dental-session';
import { ClinicalError } from '../../../domain/clinical-error.js';
import type { ClockPort } from '../../../ports/clock.js';
import type { IdPort } from '../../../ports/id.js';
import type { PacienteRepositoryPort } from '../../../ports/paciente-repository.js';
import type { OperationContext } from '../../../ports/full/context.js';
import type {
  DentalSessionRepositoryPort,
  Op59Request,
  Op59Response,
  Op60Request,
  Op60Response,
} from '../../../ports/full/dental-session.js';
import type { FirebaseUnitOfWork } from '../unit-of-work.js';

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

function money(n: number): string {
  return n.toFixed(2);
}

export function createFirebaseDentalSessionRepository(deps: {
  unitOfWork: FirebaseUnitOfWork;
  id_institucion: InstitutionId;
  pacientes: PacienteRepositoryPort;
  ids: IdPort;
  clock: ClockPort;
}): DentalSessionRepositoryPort {
  const uow = deps.unitOfWork;

  return {
    async op59(input: Op59Request, context: OperationContext): Promise<Op59Response> {
      return uow.runInTransaction(async () => {
        const plan = (await uow.read('planes_tratamiento', input.params.id)) as PlanDoc | null;
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
        const updated: PlanDoc = {
          ...plan,
          detalle: lines,
          revision: revision + 1,
          estado: allDone
            ? 'finalizado'
            : plan.estado === 'propuesto'
              ? 'en_proceso'
              : plan.estado,
        };
        uow.set('planes_tratamiento', plan.id_plan, { ...updated });

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
        await uow.create('sesiones_tratamiento', id_sesion, { ...session });
        void context;
        return session;
      });
    },

    async op60(input: Op60Request, _context: OperationContext): Promise<Op60Response> {
      return uow.runInTransaction(async () => {
        const expediente = await deps.pacientes.findExpedienteByPaciente(
          asPacienteId(input.params.id),
        );
        if (!expediente) throw new ClinicalError('not_found', NOT_FOUND);

        const plans = (await uow.query(
          'planes_tratamiento',
          (row) => row.id_expediente === expediente.id_expediente,
        )) as PlanDoc[];

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
        return {
          presupuesto: money(presupuesto),
          ejecutado: money(ejecutado),
          facturado: money(facturado),
          pagado: money(pagado),
          pendiente: money(Math.max(0, facturado - pagado)),
        };
      });
    },
  };
}

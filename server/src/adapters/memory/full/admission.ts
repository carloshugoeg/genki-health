import { createHash } from 'node:crypto';
import { asPacienteId } from '@genki/shared';
import type { ADMISION, CAMA } from '@genki/shared/full/admission';
import { ClinicalError } from '../../../domain/clinical-error.js';
import type { ClockPort } from '../../../ports/clock.js';
import type { IdPort } from '../../../ports/id.js';
import type { PacienteRepositoryPort } from '../../../ports/paciente-repository.js';
import type { UnitOfWorkPort } from '../../../ports/unit-of-work.js';
import type { OperationContext } from '../../../ports/full/context.js';
import type {
  AdmissionRepositoryPort,
  Op34Request,
  Op34Response,
  Op35Request,
  Op35Response,
} from '../../../ports/full/admission.js';
import { getExtensionNamespace } from '../full-state.js';
import type { MemoryInstitutionState } from '../state.js';
import { activeMemoryMaps } from '../unit-of-work.js';

const NOT_FOUND = 'Recurso no encontrado';
const CONFLICT = 'Conflicto de recurso';

export type MemoryAdmissionDeps = {
  state: MemoryInstitutionState;
  pacientes: PacienteRepositoryPort;
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

export function createMemoryAdmissionRepository(
  deps: MemoryAdmissionDeps,
): AdmissionRepositoryPort {
  return {
    async op34(input: Op34Request, _context: OperationContext): Promise<Op34Response> {
      return deps.unitOfWork.runInTransaction(async () => {
        const ns = getExtensionNamespace(activeMemoryMaps(deps.state), 'admission');
        const beds = [...(ns.get('cama')?.values() ?? [])] as CAMA[];
        let libre = beds.filter((b) => b.estado === 'libre');
        if (input.query.id_servicio !== undefined) {
          libre = libre.filter((b) => b.id_servicio === input.query.id_servicio);
        }
        return libre
          .slice()
          .sort((a, b) => a.id_servicio - b.id_servicio || a.id_cama - b.id_cama)
          .map(cloneDto);
      });
    },

    async op35(input: Op35Request, context: OperationContext): Promise<Op35Response> {
      return deps.unitOfWork.runInTransaction(async () => {
        const ns = getExtensionNamespace(activeMemoryMaps(deps.state), 'admission');
        const key = context.idempotency_key!;
        const idemKey = `${context.id_usuario}:${key}`;
        const prior = ns.get('idempotency')?.get(idemKey) as
          { hash: string; response: ADMISION } | undefined;
        if (prior) {
          if (prior.hash !== payloadHash(input.body)) {
            throw new ClinicalError('conflict', CONFLICT);
          }
          return cloneDto(prior.response);
        }

        const paciente = await deps.pacientes.findById(asPacienteId(input.params.id));
        if (!paciente) throw new ClinicalError('not_found', NOT_FOUND);
        const expediente = await deps.pacientes.findExpedienteByPaciente(
          asPacienteId(input.params.id),
        );
        if (!expediente) throw new ClinicalError('not_found', NOT_FOUND);
        if (expediente.estado === 'archivado') {
          throw new ClinicalError('expediente_archived', 'Expediente archivado');
        }

        const beds = ns.get('cama') ?? new Map();
        const bed = beds.get(input.body.id_cama) as CAMA | undefined;
        if (!bed || bed.estado !== 'libre') throw new ClinicalError('conflict', CONFLICT);

        for (const row of ns.get('admision')?.values() ?? []) {
          const adm = row as ADMISION;
          if (
            adm.estado === 'activa' &&
            (adm.id_expediente === expediente.id_expediente || adm.id_cama === bed.id_cama)
          ) {
            throw new ClinicalError('conflict', CONFLICT);
          }
        }

        const id_admision = await deps.ids.nextInt('admision');
        const admision: ADMISION = {
          id_admision,
          id_expediente: expediente.id_expediente,
          id_cama: bed.id_cama,
          tipo_ingreso: input.body.tipo_ingreso,
          fecha_hora_ingreso: input.body.fecha_hora_ingreso,
          id_diagnostico_ingreso: input.body.id_diagnostico_ingreso,
          estado: 'activa',
          ...(input.body.id_consulta_origen !== undefined
            ? { id_consulta_origen: input.body.id_consulta_origen }
            : {}),
        };

        if (!ns.has('admision')) ns.set('admision', new Map());
        ns.get('admision')!.set(id_admision, admision);
        beds.set(bed.id_cama, { ...bed, estado: 'ocupada' });
        if (!ns.has('idempotency')) ns.set('idempotency', new Map());
        ns.get('idempotency')!.set(idemKey, {
          hash: payloadHash(input.body),
          response: cloneDto(admision),
        });
        return cloneDto(admision);
      });
    },
  };
}

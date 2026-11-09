import { createHash } from 'node:crypto';
import { asPacienteId } from '@genki/shared';
import type { ANTECEDENTE_PERINATAL, MEDICION_ANTROPOMETRICA } from '@genki/shared/full/growth';
import { ClinicalError } from '../../../domain/clinical-error.js';
import type { ClockPort } from '../../../ports/clock.js';
import type { IdPort } from '../../../ports/id.js';
import type { PacienteRepositoryPort } from '../../../ports/paciente-repository.js';
import type { UnitOfWorkPort } from '../../../ports/unit-of-work.js';
import type { OperationContext } from '../../../ports/full/context.js';
import type {
  GrowthRepositoryPort,
  Op40Request,
  Op40Response,
  Op41Request,
  Op41Response,
  Op42Request,
  Op42Response,
} from '../../../ports/full/growth.js';
import { getExtensionNamespace } from '../full-state.js';
import type { MemoryInstitutionState } from '../state.js';
import { activeMemoryMaps } from '../unit-of-work.js';

const NOT_FOUND = 'Recurso no encontrado';

export type MemoryGrowthDeps = {
  state: MemoryInstitutionState;
  pacientes: PacienteRepositoryPort;
  ids: IdPort;
  unitOfWork: UnitOfWorkPort;
  clock: ClockPort;
};

function cloneDto<T>(v: T): T {
  return structuredClone(v);
}
function payloadHash(body: unknown): string {
  return createHash('sha256').update(JSON.stringify(body)).digest('hex');
}

export function createMemoryGrowthRepository(deps: MemoryGrowthDeps): GrowthRepositoryPort {
  return {
    async op40(input: Op40Request, context: OperationContext): Promise<Op40Response> {
      return deps.unitOfWork.runInTransaction(async () => {
        const ns = getExtensionNamespace(activeMemoryMaps(deps.state), 'growth');
        const expediente = await deps.pacientes.findExpedienteByPaciente(
          asPacienteId(input.params.id),
        );
        if (!expediente) throw new ClinicalError('not_found', NOT_FOUND);
        const row: ANTECEDENTE_PERINATAL = {
          id_expediente: expediente.id_expediente,
          ...input.body,
        };
        if (!ns.has('antecedente_perinatal')) ns.set('antecedente_perinatal', new Map());
        ns.get('antecedente_perinatal')!.set(expediente.id_expediente, row);
        void context;
        return cloneDto(row);
      });
    },

    async op41(input: Op41Request, context: OperationContext): Promise<Op41Response> {
      return deps.unitOfWork.runInTransaction(async () => {
        const ns = getExtensionNamespace(activeMemoryMaps(deps.state), 'growth');
        const maps = activeMemoryMaps(deps.state);
        const consulta = [...maps.consultas.values()].find(
          (c) => (c as { id_consulta?: number }).id_consulta === input.params.id,
        ) as { id_consulta: number; id_expediente: number } | undefined;
        if (!consulta) throw new ClinicalError('not_found', NOT_FOUND);
        const id_medicion = await deps.ids.nextInt('medicion_antropometrica');
        const row: MEDICION_ANTROPOMETRICA = {
          id_medicion,
          id_consulta: consulta.id_consulta,
          fecha_medicion: input.body.fecha_medicion,
          edad_meses: 0,
          peso_kg: input.body.peso_kg,
          talla_cm: input.body.talla_cm,
          version_referencia: 'none',
          ...(input.body.perimetro_cefalico_cm !== undefined
            ? { perimetro_cefalico_cm: input.body.perimetro_cefalico_cm }
            : {}),
        };
        if (!ns.has('medicion')) ns.set('medicion', new Map());
        ns.get('medicion')!.set(id_medicion, { ...row, id_expediente: consulta.id_expediente });
        void context;
        return cloneDto(row);
      });
    },

    async op42(input: Op42Request, _context: OperationContext): Promise<Op42Response> {
      return deps.unitOfWork.runInTransaction(async () => {
        const ns = getExtensionNamespace(activeMemoryMaps(deps.state), 'growth');
        const expediente = await deps.pacientes.findExpedienteByPaciente(
          asPacienteId(input.params.id),
        );
        if (!expediente) throw new ClinicalError('not_found', NOT_FOUND);
        const rows = [...(ns.get('medicion')?.values() ?? [])] as Array<
          MEDICION_ANTROPOMETRICA & { id_expediente: number }
        >;
        return rows
          .filter((r) => r.id_expediente === expediente.id_expediente)
          .map(({ id_expediente: _e, ...rest }) => cloneDto(rest))
          .sort((a, b) => a.id_medicion - b.id_medicion);
      });
    },
  };
}

void payloadHash;

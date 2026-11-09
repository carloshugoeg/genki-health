import { asPacienteId } from '@genki/shared';
import type { DOSIS_VACUNA, DosisPendiente, DosisSchedule, Page } from '@genki/shared/full/vaccines';
import { ClinicalError } from '../../../domain/clinical-error.js';
import type { ClockPort } from '../../../ports/clock.js';
import type { IdPort } from '../../../ports/id.js';
import type { PacienteRepositoryPort } from '../../../ports/paciente-repository.js';
import type { UnitOfWorkPort } from '../../../ports/unit-of-work.js';
import type { OperationContext } from '../../../ports/full/context.js';
import type {
  Op43Request,
  Op43Response,
  Op44Request,
  Op44Response,
  Op45Request,
  Op45Response,
  Op47Request,
  Op47Response,
  VaccinesRepositoryPort,
} from '../../../ports/full/vaccines.js';
import { getExtensionNamespace } from '../full-state.js';
import type { MemoryInstitutionState } from '../state.js';
import { activeMemoryMaps } from '../unit-of-work.js';

const NOT_FOUND = 'Recurso no encontrado';
const CONFLICT = 'Conflicto de recurso';

export type MemoryVaccinesDeps = {
  state: MemoryInstitutionState;
  pacientes: PacienteRepositoryPort;
  ids: IdPort;
  unitOfWork: UnitOfWorkPort;
  clock: ClockPort;
};

function cloneDto<T>(v: T): T {
  return structuredClone(v);
}

export function createMemoryVaccinesRepository(deps: MemoryVaccinesDeps): VaccinesRepositoryPort {
  return {
    async op43(input: Op43Request, _context: OperationContext): Promise<Op43Response> {
      return deps.unitOfWork.runInTransaction(async () => {
        const ns = getExtensionNamespace(activeMemoryMaps(deps.state), 'vaccines');
        const expediente = await deps.pacientes.findExpedienteByPaciente(asPacienteId(input.params.id));
        if (!expediente) throw new ClinicalError('not_found', NOT_FOUND);
        const today = (deps.clock.nowIso() || '').slice(0, 10);
        const rows = [...(ns.get('dosis')?.values() ?? [])] as DOSIS_VACUNA[];
        return rows
          .filter((d) => d.id_expediente === expediente.id_expediente)
          .map((d) => ({
            ...cloneDto(d),
            atrasada: d.estado === 'programada' && d.fecha_programada < today,
            version_esquema: 'MVP-1',
          })) as DosisSchedule[];
      });
    },

    async op44(input: Op44Request, _context: OperationContext): Promise<Op44Response> {
      return deps.unitOfWork.runInTransaction(async () => {
        const ns = getExtensionNamespace(activeMemoryMaps(deps.state), 'vaccines');
        const dosis = ns.get('dosis')?.get(input.params.id) as DOSIS_VACUNA | undefined;
        if (!dosis) throw new ClinicalError('not_found', NOT_FOUND);
        if (dosis.estado === 'aplicada') throw new ClinicalError('conflict', CONFLICT);
        const updated: DOSIS_VACUNA = {
          ...dosis,
          fecha_aplicacion: input.body.fecha_aplicacion,
          lote: input.body.lote,
          id_profesional: input.body.id_profesional,
          estado: 'aplicada',
          ...(input.body.fabricante !== undefined ? { fabricante: input.body.fabricante } : {}),
          ...(input.body.sitio_aplicacion !== undefined
            ? { sitio_aplicacion: input.body.sitio_aplicacion }
            : {}),
        };
        ns.get('dosis')!.set(dosis.id_dosis, updated);
        return cloneDto(updated);
      });
    },

    async op45(input: Op45Request, _context: OperationContext): Promise<Op45Response> {
      return deps.unitOfWork.runInTransaction(async () => {
        const ns = getExtensionNamespace(activeMemoryMaps(deps.state), 'vaccines');
        const dosis = ns.get('dosis')?.get(input.params.id) as DOSIS_VACUNA | undefined;
        if (!dosis) throw new ClinicalError('not_found', NOT_FOUND);
        if (dosis.estado !== 'aplicada') throw new ClinicalError('conflict', CONFLICT);
        const updated: DOSIS_VACUNA = { ...dosis, reaccion_adversa: input.body.reaccion_adversa };
        ns.get('dosis')!.set(dosis.id_dosis, updated);
        return cloneDto(updated);
      });
    },

    async op47(input: Op47Request, _context: OperationContext): Promise<Op47Response> {
      return deps.unitOfWork.runInTransaction(async () => {
        const ns = getExtensionNamespace(activeMemoryMaps(deps.state), 'vaccines');
        const hasta = input.query.hasta;
        const page = input.query.page ?? 1;
        const page_size = input.query.page_size ?? 20;
        const rows = [...(ns.get('dosis')?.values() ?? [])] as DOSIS_VACUNA[];
        const pending = rows.filter(
          (d) => d.estado === 'programada' && d.fecha_programada <= hasta,
        );
        const items: DosisPendiente[] = [];
        for (const d of pending) {
          items.push({
            ...cloneDto(d),
            atrasada: true,
            version_esquema: 'MVP-1',
            id_paciente: 0,
            nombre: '',
            telefono: null,
          });
        }
        const start = (page - 1) * page_size;
        const slice = items.slice(start, start + page_size);
        const out: Page<DosisPendiente> = {
          items: slice,
          page,
          page_size,
          total: items.length,
        };
        return out;
      });
    },
  };
}

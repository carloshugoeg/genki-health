import { asPacienteId } from '@genki/shared';
import type { ODONTOGRAMA, PIEZA_DENTAL } from '@genki/shared/full/dental-chart';
import { ClinicalError } from '../../../domain/clinical-error.js';
import { FDI_TEETH } from '../../../domain/full/dental-chart.js';
import type { ClockPort } from '../../../ports/clock.js';
import type { IdPort } from '../../../ports/id.js';
import type { PacienteRepositoryPort } from '../../../ports/paciente-repository.js';
import type { UnitOfWorkPort } from '../../../ports/unit-of-work.js';
import type { OperationContext } from '../../../ports/full/context.js';
import type {
  DentalChartRepositoryPort,
  Op55Request,
  Op55Response,
  Op56Request,
  Op56Response,
} from '../../../ports/full/dental-chart.js';
import { getExtensionNamespace } from '../full-state.js';
import type { MemoryInstitutionState } from '../state.js';
import { activeMemoryMaps } from '../unit-of-work.js';

const NOT_FOUND = 'Recurso no encontrado';
const CONFLICT = 'Conflicto de recurso';

type PiezaRow = PIEZA_DENTAL & { revision: number };

export function createMemoryDentalChartRepository(deps: {
  state: MemoryInstitutionState;
  pacientes: PacienteRepositoryPort;
  ids: IdPort;
  unitOfWork: UnitOfWorkPort;
  clock: ClockPort;
}): DentalChartRepositoryPort {
  return {
    async op55(input: Op55Request, context: OperationContext): Promise<Op55Response> {
      return deps.unitOfWork.runInTransaction(async () => {
        const ns = getExtensionNamespace(activeMemoryMaps(deps.state), 'dental-chart');
        const expediente = await deps.pacientes.findExpedienteByPaciente(
          asPacienteId(input.params.id),
        );
        if (!expediente) throw new ClinicalError('not_found', NOT_FOUND);
        const id_odontograma = await deps.ids.nextInt('odontograma');
        const chart: ODONTOGRAMA = {
          id_odontograma,
          id_expediente: expediente.id_expediente,
          fecha: (context.now || deps.clock.nowIso()).slice(0, 10),
          notacion: 'FDI',
          id_profesional: input.body.id_profesional,
          ...(input.body.observacion_general !== undefined
            ? { observacion_general: input.body.observacion_general }
            : {}),
        };
        if (!ns.has('odontograma')) ns.set('odontograma', new Map());
        ns.get('odontograma')!.set(id_odontograma, chart);
        if (!ns.has('pieza')) ns.set('pieza', new Map());
        for (const numero of FDI_TEETH) {
          const pieza: PiezaRow = {
            id_odontograma,
            numero_pieza: numero,
            estado: 'sana',
            superficies: {},
            movilidad: 0,
            revision: 0,
          };
          ns.get('pieza')!.set(`${id_odontograma}:${numero}`, pieza);
        }
        return structuredClone(chart);
      });
    },

    async op56(input: Op56Request, _context: OperationContext): Promise<Op56Response> {
      return deps.unitOfWork.runInTransaction(async () => {
        const ns = getExtensionNamespace(activeMemoryMaps(deps.state), 'dental-chart');
        const key = `${input.params.id}:${input.params.numero}`;
        const pieza = ns.get('pieza')?.get(key) as PiezaRow | undefined;
        if (!pieza) throw new ClinicalError('not_found', NOT_FOUND);
        if (pieza.revision !== input.body.expected_revision) {
          throw new ClinicalError('conflict', CONFLICT);
        }
        const updated: PiezaRow = {
          id_odontograma: pieza.id_odontograma,
          numero_pieza: pieza.numero_pieza,
          estado: input.body.estado,
          superficies: input.body.superficies as PIEZA_DENTAL['superficies'],
          movilidad: input.body.movilidad,
          revision: pieza.revision + 1,
          ...(input.body.observacion !== undefined ? { observacion: input.body.observacion } : {}),
        };
        ns.get('pieza')!.set(key, updated);
        const { revision: _r, ...dto } = updated;
        return structuredClone(dto);
      });
    },
  };
}

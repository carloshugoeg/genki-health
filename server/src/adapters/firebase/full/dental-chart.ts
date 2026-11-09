import { asPacienteId, type InstitutionId } from '@genki/shared';
import type { ODONTOGRAMA, PIEZA_DENTAL } from '@genki/shared/full/dental-chart';
import { ClinicalError } from '../../../domain/clinical-error.js';
import { FDI_TEETH } from '../../../domain/full/dental-chart.js';
import type { ClockPort } from '../../../ports/clock.js';
import type { IdPort } from '../../../ports/id.js';
import type { PacienteRepositoryPort } from '../../../ports/paciente-repository.js';
import type { OperationContext } from '../../../ports/full/context.js';
import type {
  DentalChartRepositoryPort,
  Op55Request,
  Op55Response,
  Op56Request,
  Op56Response,
} from '../../../ports/full/dental-chart.js';
import type { FirebaseUnitOfWork } from '../unit-of-work.js';

const NOT_FOUND = 'Recurso no encontrado';
const CONFLICT = 'Conflicto de recurso';

type PiezaRow = PIEZA_DENTAL & { revision: number };

export function createFirebaseDentalChartRepository(deps: {
  unitOfWork: FirebaseUnitOfWork;
  id_institucion: InstitutionId;
  pacientes: PacienteRepositoryPort;
  ids: IdPort;
  clock: ClockPort;
}): DentalChartRepositoryPort {
  const uow = deps.unitOfWork;

  return {
    async op55(input: Op55Request, context: OperationContext): Promise<Op55Response> {
      return uow.runInTransaction(async () => {
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
        await uow.create('odontogramas', id_odontograma, { ...chart });
        for (const numero of FDI_TEETH) {
          const pieza: PiezaRow = {
            id_odontograma,
            numero_pieza: numero,
            estado: 'sana',
            superficies: {},
            movilidad: 0,
            revision: 0,
          };
          await uow.create('piezas_dentales', `${id_odontograma}_${numero}`, { ...pieza });
        }
        return chart;
      });
    },

    async op56(input: Op56Request, _context: OperationContext): Promise<Op56Response> {
      return uow.runInTransaction(async () => {
        const key = `${input.params.id}_${input.params.numero}`;
        const pieza = (await uow.read('piezas_dentales', key)) as PiezaRow | null;
        if (!pieza) throw new ClinicalError('not_found', NOT_FOUND);
        if (Number(pieza.revision) !== input.body.expected_revision) {
          throw new ClinicalError('conflict', CONFLICT);
        }
        const updated: PiezaRow = {
          id_odontograma: Number(pieza.id_odontograma),
          numero_pieza: Number(pieza.numero_pieza),
          estado: input.body.estado,
          superficies: input.body.superficies as PIEZA_DENTAL['superficies'],
          movilidad: input.body.movilidad,
          revision: Number(pieza.revision) + 1,
          ...(input.body.observacion !== undefined ? { observacion: input.body.observacion } : {}),
        };
        uow.set('piezas_dentales', key, { ...updated });
        const { revision: _r, ...dto } = updated;
        return dto;
      });
    },
  };
}

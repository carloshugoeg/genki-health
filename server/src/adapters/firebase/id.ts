import type { IdPort } from '../../ports/index.js';
import type { FirebaseUnitOfWork } from './unit-of-work.js';

const sequences = new Set([
  'paciente',
  'expediente',
  'responsable',
  'consulta',
  'diagnostico',
  'tratamiento',
  'receta',
  'receta_folio',
  'antecedente',
  'alergia',
  'documento_adjunto',
  'signos_vitales',
  'odontograma',
  'plan_tratamiento',
  'sesion_tratamiento',
  'reactivacion_audit',
]);

export class FirebaseId implements IdPort {
  constructor(private readonly unitOfWork: FirebaseUnitOfWork) {}

  async nextInt(sequence: string): Promise<number> {
    if (!sequences.has(sequence)) throw new Error('Unknown Firestore counter');
    return this.unitOfWork.nextCounter(sequence);
  }
}

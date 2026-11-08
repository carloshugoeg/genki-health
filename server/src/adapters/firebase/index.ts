import type { AdapterResource, FirestoreOptions } from '../../ports/index.js';
import { FirebaseUnitOfWork } from './unit-of-work.js';
import { FirebaseId } from './id.js';
import { FirebaseCatalogoRepository } from './catalogo-repository.js';
import { FirebasePacienteRepository } from './paciente-repository.js';
import { FirebaseConsultaRepository } from './consulta-repository.js';

export async function createFirebaseAdapterSet(
  options: FirestoreOptions,
): Promise<AdapterResource> {
  const unitOfWork = new FirebaseUnitOfWork(options);
  try {
    // Fail initialization when the explicitly configured emulator cannot be read.
    await unitOfWork.query('municipios');
    const ids = new FirebaseId(unitOfWork);
    const clock = options.clock ?? { nowIso: () => new Date().toISOString() };
    return {
      set: {
        engine: 'firebase',
        unitOfWork,
        ids,
        clock,
        pacientes: new FirebasePacienteRepository(
          unitOfWork,
          ids,
          options.id_institucion,
          options.kind,
          () => clock.nowIso(),
        ),
        consultas: new FirebaseConsultaRepository(unitOfWork, ids, () => clock.nowIso()),
        catalogos: new FirebaseCatalogoRepository(unitOfWork),
      },
      close: () => unitOfWork.close(),
    };
  } catch (error) {
    await unitOfWork.close();
    throw error;
  }
}

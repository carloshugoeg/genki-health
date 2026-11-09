import { INSTITUTION_ENGINE_ASSIGNMENTS } from '@genki/shared';
import { ClinicalError } from '../../domain/clinical-error.js';
import type { AdapterResource, FirestoreOptions } from '../../ports/index.js';
import { FirebaseUnitOfWork } from './unit-of-work.js';
import { FirebaseId } from './id.js';
import { FirebaseCatalogoRepository } from './catalogo-repository.js';
import { createFirebaseDentalChartRepository } from './full/dental-chart.js';
import { createFirebaseDentalPlanRepository } from './full/dental-plan.js';
import { createFirebaseDentalSessionRepository } from './full/dental-session.js';
import { FirebaseAgendaRepository } from './full/agenda.js';
import { FirebaseEconomicStore } from './full/charges.js';
import { createFirebaseLane1Repositories } from './full/lane1.js';
import { clinicalEconomicReferences, laneABModulesFrom } from '../../config/lane-ab-modules.js';
import { FirebasePacienteRepository } from './paciente-repository.js';
import { FirebaseConsultaRepository } from './consulta-repository.js';

export async function createFirebaseAdapterSet(
  options: FirestoreOptions,
): Promise<AdapterResource> {
  // Admin bypasses rules. Scope comes from trusted backend composition, never a client selector.
  // Snapshot before the first await so external mutation cannot split path and DTO institutions.
  const scoped = Object.freeze({ ...options });
  const disposable = /^demo-test-genki-[a-z0-9-]+$/.test(scoped.projectId);
  const knownKind = INSTITUTION_ENGINE_ASSIGNMENTS.some((row) => row.kind === scoped.kind);
  const allowed = disposable
    ? knownKind && (scoped.id_institucion === 4 || scoped.id_institucion === 99)
    : scoped.id_institucion === 4 && scoped.kind === 'clinica_odontologica';
  if (!allowed) {
    throw new ClinicalError(
      'misconfigured',
      'Firestore requiere Odontología/4; contextos alternos solo en proyectos demo-test-genki',
    );
  }
  const unitOfWork = new FirebaseUnitOfWork(scoped);
  try {
    // Fail initialization when the explicitly configured emulator cannot be read.
    await unitOfWork.query('municipios');
    const ids = new FirebaseId(unitOfWork);
    const clock = scoped.clock ?? { nowIso: () => new Date().toISOString() };
    const pacientes = new FirebasePacienteRepository(
      unitOfWork,
      ids,
      scoped.id_institucion,
      scoped.kind,
      () => clock.nowIso(),
    );
    const dentalDeps = {
      unitOfWork,
      id_institucion: scoped.id_institucion,
      pacientes,
      ids,
      clock,
    };
    const lane1 = createFirebaseLane1Repositories(dentalDeps);
    const firestore = unitOfWork.firestore();
    const laneAB = laneABModulesFrom(
      new FirebaseEconomicStore(
        firestore,
        scoped.id_institucion,
        clinicalEconomicReferences(pacientes),
      ),
      new FirebaseAgendaRepository(firestore),
    );
    const full = {
      ...lane1,
      dentalChart: createFirebaseDentalChartRepository(dentalDeps),
      dentalPlan: createFirebaseDentalPlanRepository(dentalDeps),
      dentalSession: createFirebaseDentalSessionRepository(dentalDeps),
      ...laneAB,
    };
    return {
      set: {
        engine: 'firebase',
        unitOfWork,
        ids,
        clock,
        pacientes,
        consultas: new FirebaseConsultaRepository(unitOfWork, ids, () => clock.nowIso()),
        catalogos: new FirebaseCatalogoRepository(unitOfWork),
        full,
      },
      close: () => unitOfWork.close(),
    };
  } catch (error) {
    await unitOfWork.close();
    throw error;
  }
}

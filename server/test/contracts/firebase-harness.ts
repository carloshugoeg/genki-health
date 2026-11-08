import { randomUUID } from 'node:crypto';
import { deleteApp, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { asInstitutionId, type InstitutionKind } from '@genki/shared';
import type { ClinicalContext, PersistenceCheckpoint } from '../../src/ports/index.js';
import { FirebaseUnitOfWork } from '../../src/adapters/firebase/unit-of-work.js';
import { FirebaseId } from '../../src/adapters/firebase/id.js';
import { FirebaseCatalogoRepository } from '../../src/adapters/firebase/catalogo-repository.js';
import { FirebasePacienteRepository } from '../../src/adapters/firebase/paciente-repository.js';

/** Partial patient harness. No consultation stub or claim of a complete engine adapter. */
export async function makeFirebasePatientHarness(options: { kind?: InstitutionKind } = {}) {
  const emulatorHost = process.env.FIRESTORE_EMULATOR_HOST;
  if (!emulatorHost || !/^(127\.0\.0\.1|localhost|\[::1\]):[0-9]+$/.test(emulatorHost)) {
    throw new Error('Patient integration tests require loopback FIRESTORE_EMULATOR_HOST');
  }
  const projectId = `demo-test-genki-patient-${randomUUID().slice(0, 8)}`;
  const kind = options.kind ?? 'clinica_odontologica';
  const owner = initializeApp({ projectId }, `patient-test-owner-${randomUUID()}`);
  const db = getFirestore(owner);
  db.settings({ host: emulatorHost, ssl: false });
  const resources: FirebaseUnitOfWork[] = [];
  const clock = { nowIso: () => '2026-11-08T18:00:00.000Z' };
  let failure: PersistenceCheckpoint | undefined;
  function contextFor(
    id: number,
  ): Pick<ClinicalContext, 'pacientes' | 'catalogos' | 'unitOfWork' | 'clock' | 'ids'> {
    const id_institucion = asInstitutionId(id);
    const unitOfWork = new FirebaseUnitOfWork({
      id_institucion,
      kind,
      projectId,
      emulatorHost: emulatorHost!,
      afterWrite: (point) => {
        if (failure === point) {
          failure = undefined;
          throw new Error(`injected ${point}`);
        }
      },
    });
    resources.push(unitOfWork);
    const ids = new FirebaseId(unitOfWork);
    return {
      unitOfWork,
      ids,
      clock,
      pacientes: new FirebasePacienteRepository(
        unitOfWork,
        ids,
        id_institucion,
        kind,
        clock.nowIso,
      ),
      catalogos: new FirebaseCatalogoRepository(unitOfWork),
    };
  }
  const context = contextFor(4);
  async function seed(id: number) {
    const root = db.doc(`institutions/${id}`);
    await root
      .collection('municipios')
      .doc('1')
      .set({ id_municipio: 1, nombre: 'Municipio de prueba' });
    await root
      .collection('professionals')
      .doc('1')
      .set({
        id_profesional: 1,
        nombres: 'Profesional',
        apellidos: 'Simulado',
        numero_colegiado: 'DEMO-1',
        activo: true,
      });
    await root
      .collection('cie10')
      .doc('Z00.0')
      .set({ codigo_cie10: 'Z00.0', descripcion: 'Examen general' });
    for (const id_medicamento of [1, 2]) {
      await root
        .collection('medications')
        .doc(String(id_medicamento))
        .set({
          id_medicamento,
          nombre_generico: `Medicamento didáctico ${id_medicamento}`,
          activo: true,
        });
    }
  }
  async function reset() {
    if (!projectId.startsWith('demo-test-genki-')) throw new Error('Unsafe test reset project');
    failure = undefined;
    for (const id of [4, 99]) {
      await db.recursiveDelete(db.doc(`institutions/${id}`));
      await seed(id);
    }
    // Deliberately different sequences prove patient id is not record id.
    await db.doc('institutions/4/counters/expediente').set({ next: 101 });
  }
  return {
    context,
    reset,
    failNext(point: PersistenceCheckpoint) {
      failure = point;
    },
    async counts() {
      const entries = await Promise.all(
        ['patients', 'records', 'responsibles', 'documentKeys', 'counters'].map(
          async (collection) =>
            [collection, (await db.collection(`institutions/4/${collection}`).get()).size] as const,
        ),
      );
      return Object.fromEntries(entries) as Record<string, number>;
    },
    async otherInstitution() {
      return contextFor(99);
    },
    async close() {
      try {
        if (!projectId.startsWith('demo-test-genki-')) throw new Error('Unsafe cleanup project');
        for (const id of [4, 99]) await db.recursiveDelete(db.doc(`institutions/${id}`));
      } finally {
        await Promise.all(resources.map((resource) => resource.close()));
        await db.terminate();
        await deleteApp(owner);
      }
    },
  };
}

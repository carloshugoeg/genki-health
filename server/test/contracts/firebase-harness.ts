import { randomUUID } from 'node:crypto';
import { deleteApp, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { asInstitutionId, type InstitutionKind } from '@genki/shared';
import type {
  AdapterResource,
  ClinicalContext,
  PersistenceCheckpoint,
  CloseConsultaBundle,
} from '../../src/ports/index.js';
import type { CloseConsultaRequest, PacienteId } from '@genki/shared';
import type { ClinicalHarness, ContractClinicalContext } from './harness.js';
import {
  expectedPrimaryCatalog,
  expectedInstitution99Catalog,
} from '../../src/testing/catalog-seeds.js';
import { closeConsulta } from '../../src/application/close-consulta.js';
import { createFirebaseAdapterSet } from '../../src/adapters/firebase/index.js';

/** Disposable emulator harness; owner cleanup remains separate from runtime repositories. */
export async function makeFirebasePatientHarness(
  options: { kind?: InstitutionKind; distinctSecondaryIds?: boolean } = {},
) {
  const emulatorHost = process.env.FIRESTORE_EMULATOR_HOST;
  if (!emulatorHost || !/^(127\.0\.0\.1|localhost|\[::1\]):[0-9]+$/.test(emulatorHost)) {
    throw new Error('Patient integration tests require loopback FIRESTORE_EMULATOR_HOST');
  }
  const projectId = `demo-test-genki-patient-${randomUUID().slice(0, 8)}`;
  const kind = options.kind ?? 'clinica_odontologica';
  const owner = initializeApp({ projectId }, `patient-test-owner-${randomUUID()}`);
  const db = getFirestore(owner);
  db.settings({ host: emulatorHost, ssl: false });
  const resources: AdapterResource[] = [];
  const clock = { nowIso: () => '2026-11-08T18:00:00.000Z' };
  let failure: PersistenceCheckpoint | undefined;
  async function contextFor(id: number): Promise<ClinicalContext> {
    const resource = await createFirebaseAdapterSet({
      id_institucion: asInstitutionId(id),
      kind,
      projectId,
      emulatorHost: emulatorHost!,
      clock,
      afterWrite: (point) => {
        if (failure === point) {
          failure = undefined;
          throw new Error(`injected ${point}`);
        }
      },
    });
    resources.push(resource);
    return resource.set;
  }
  const context = await contextFor(4);
  async function seed(id: number) {
    const root = db.doc(`institutions/${id}`);
    const catalog = id === 99 ? expectedInstitution99Catalog() : expectedPrimaryCatalog();
    for (const row of catalog.municipios)
      await root.collection('municipios').doc(String(row.id_municipio)).set(row);
    for (const row of catalog.profesionales)
      await root
        .collection('professionals')
        .doc(String(row.id_profesional))
        .set({ ...row, activo: true, numero_colegiado: 'DEMO-1' });
    for (const row of catalog.medicamentos)
      await root
        .collection('medications')
        .doc(String(row.id_medicamento))
        .set({ ...row, activo: true });
    await root
      .collection('cie10')
      .doc('Z00.0')
      .set({ codigo_cie10: 'Z00.0', descripcion: 'Examen general' });
  }

  async function reset() {
    if (!projectId.startsWith('demo-test-genki-')) throw new Error('Unsafe test reset project');
    failure = undefined;
    for (const id of [4, 99]) {
      await db.recursiveDelete(db.doc(`institutions/${id}`));
      await seed(id);
    }
    // Shared suite passes foreign numeric IDs into primary lookups; keep those fixture IDs disjoint.
    if (options.distinctSecondaryIds) {
      for (const sequence of [
        'paciente',
        'expediente',
        'responsable',
        'consulta',
        'diagnostico',
        'tratamiento',
        'receta',
      ]) {
        await db.doc(`institutions/99/counters/${sequence}`).set({ next: 10001 });
      }
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
    async clinicalCounts() {
      const root = db.doc('institutions/4');
      const [patients, records, responsibles, consultations] = await Promise.all(
        ['patients', 'records', 'responsibles', 'consultations'].map((name) =>
          root.collection(name).get(),
        ),
      );
      const bundles = consultations!.docs.map((doc) => doc.data());
      return {
        pacientes: patients!.size,
        expedientes: records!.size,
        responsables: responsibles!.size,
        consultas: consultations!.size,
        diagnosticos: bundles.reduce((n, row) => n + row.diagnosticos.length, 0),
        tratamientos: bundles.reduce((n, row) => n + row.tratamientos.length, 0),
        recetas: bundles.filter((row) => row.receta != null).length,
        detalles: bundles.reduce((n, row) => n + row.detalles.length, 0),
      };
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

function facade(context: ClinicalContext): ContractClinicalContext {
  return {
    ...context,
    consultas: {
      closeConsulta(
        input: CloseConsultaBundle | { id_paciente: PacienteId; body: CloseConsultaRequest },
      ) {
        return 'consulta' in input
          ? context.consultas.closeConsulta(input)
          : closeConsulta(context, input);
      },
      findById: (id) => context.consultas.findById(id),
      listByExpediente: (id) => context.consultas.listByExpediente(id),
    },
  };
}

export async function makeFirebaseClinicalHarness(options?: {
  kind?: InstitutionKind;
}): Promise<ClinicalHarness> {
  const patient = await makeFirebasePatientHarness({ ...options, distinctSecondaryIds: true });
  return {
    context: facade(patient.context),
    reset: patient.reset,
    failNext: patient.failNext,
    counts: patient.clinicalCounts,
    close: patient.close,
    otherInstitution: async () => facade(await patient.otherInstitution()),
  };
}

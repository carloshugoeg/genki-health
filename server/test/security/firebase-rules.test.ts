import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';

/**
 * C5.2 direct-client rules proof for Odontología.
 * Admin SDK / withSecurityRulesDisabled seeding deliberately bypasses rules;
 * these cases prove client SDK paths only. Genki JWTs are never Firebase tokens.
 */
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const rulesPath = path.join(repoRoot, 'infra/firebase/firestore.rules');
const indexesPath = path.join(repoRoot, 'infra/firebase/firestore.indexes.json');

describe('firestore security rules (C5.2)', () => {
  let testEnv: RulesTestEnvironment;

  beforeAll(async () => {
    const rules = readFileSync(rulesPath, 'utf8');
    const indexes = JSON.parse(readFileSync(indexesPath, 'utf8')) as {
      indexes: Array<{ collectionGroup: string; fields: Array<{ fieldPath: string; order: string }> }>;
    };
    const records = indexes.indexes.find((entry) => entry.collectionGroup === 'records');
    const consultations = indexes.indexes.find((entry) => entry.collectionGroup === 'consultations');
    if (!records?.fields.some((field) => field.fieldPath === 'estado')) {
      throw new Error('firestore.indexes.json missing records estado/id_paciente composite');
    }
    if (!records.fields.some((field) => field.fieldPath === 'id_paciente')) {
      throw new Error('firestore.indexes.json missing records estado/id_paciente composite');
    }
    if (
      !consultations ||
      consultations.fields.map((field) => `${field.fieldPath}:${field.order}`).join('|') !==
        'id_expediente:ASCENDING|fecha_hora_inicio:DESCENDING|id_consulta:DESCENDING'
    ) {
      throw new Error(
        'firestore.indexes.json missing consultations id_expediente ASC + fecha_hora_inicio DESC + id_consulta DESC',
      );
    }

    testEnv = await initializeTestEnvironment({
      projectId: 'demo-genki-health',
      firestore: {
        rules,
        host: '127.0.0.1',
        port: 8080,
      },
    });
  });

  afterAll(async () => {
    await testEnv?.cleanup();
  });

  beforeEach(async () => {
    await testEnv.clearFirestore();
    // Admin-style seed: bypasses rules on purpose (documented C5.2 limitation).
    await testEnv.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore();
      await setDoc(doc(db, 'institutions/4/reportes/resumen'), {
        pacientes_activos: 2,
        pacientes_archivados: 1,
      });
      await setDoc(doc(db, 'institutions/3/reportes/resumen'), {
        pacientes_activos: 0,
        pacientes_archivados: 0,
      });
      await setDoc(doc(db, 'institutions/4/patients/101'), {
        id_paciente: 101,
        id_institucion: 4,
        nombres: 'Paciente Ejemplo Uno',
      });
    });
  });

  it('firestore_unauthenticated_denied', async () => {
    const db = testEnv.unauthenticatedContext().firestore();
    await assertFails(getDoc(doc(db, 'institutions/4/reportes/resumen')));
    await assertFails(getDoc(doc(db, 'institutions/4/patients/101')));
  });

  it('firestore_matching_reporter_only_reads_report', async () => {
    const db = testEnv
      .authenticatedContext('reporter-4', {
        institution_id: '4',
        role: 'reporter',
      })
      .firestore();
    await assertSucceeds(getDoc(doc(db, 'institutions/4/reportes/resumen')));
    await assertFails(getDoc(doc(db, 'institutions/4/patients/101')));
    await assertFails(
      setDoc(doc(db, 'institutions/4/reportes/resumen'), {
        pacientes_activos: 99,
        pacientes_archivados: 1,
      }),
    );
  });

  it('firestore_other_institution_report_denied', async () => {
    const db = testEnv
      .authenticatedContext('reporter-3', {
        institution_id: '3',
        role: 'reporter',
      })
      .firestore();
    await assertFails(getDoc(doc(db, 'institutions/4/reportes/resumen')));
  });

  it('firestore_direct_clinical_writes_denied', async () => {
    const db = testEnv
      .authenticatedContext('reporter-4', {
        institution_id: '4',
        role: 'reporter',
      })
      .firestore();
    await assertFails(
      setDoc(doc(db, 'institutions/4/patients/102'), {
        id_paciente: 102,
        id_institucion: 4,
      }),
    );
    await assertFails(
      setDoc(doc(db, 'institutions/4/consultations/1'), {
        id_consulta: 1,
        id_expediente: 101,
      }),
    );
  });
});

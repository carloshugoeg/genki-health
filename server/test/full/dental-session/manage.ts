/**
 * Idempotent Firestore dental-session collection touch for db:setup:all.
 * Honors FIRESTORE_MODE=real without forcing the emulator.
 * npx tsx server/test/full/dental-session/manage.ts migrate
 */
import { randomUUID } from 'node:crypto';
import { applicationDefault, deleteApp, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const [command] = process.argv.slice(2);
if (command !== 'migrate' && command !== 'seed') {
  throw new Error('Uso: manage.ts migrate|seed');
}

const mode = (process.env.FIRESTORE_MODE ?? 'emulator').trim() || 'emulator';
const projectId = process.env.FIREBASE_PROJECT_ID ?? process.env.GCLOUD_PROJECT;
if (!projectId) throw new Error('FIREBASE_PROJECT_ID or GCLOUD_PROJECT required');

if (mode === 'real') {
  if (projectId.startsWith('demo-') || process.env.FIRESTORE_EMULATOR_HOST) {
    throw new Error('FIRESTORE_MODE=real requires non-demo project and no emulator host');
  }
} else if (
  !projectId.startsWith('demo-') ||
  !/^(127\.0\.0\.1|localhost|\[::1\]):[0-9]+$/.test(process.env.FIRESTORE_EMULATOR_HOST ?? '')
) {
  throw new Error('emulator mode requires demo project and loopback FIRESTORE_EMULATOR_HOST');
}

const app = initializeApp(
  mode === 'real' ? { projectId, credential: applicationDefault() } : { projectId },
  `dental-session-${randomUUID()}`,
);
const db = getFirestore(app);
try {
  const marker = db.doc('institutions/4/sesiones_tratamiento/_setup');
  await marker.set(
    { module: 'dental-session', touched_at: new Date().toISOString() },
    { merge: true },
  );
  console.log(`firebase: ${command} OK`);
} finally {
  await deleteApp(app);
}

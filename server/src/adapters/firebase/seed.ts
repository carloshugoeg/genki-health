import type { FirestoreOptions } from '../../ports/index.js';
import { FirebaseUnitOfWork } from './unit-of-work.js';
import { documentKey } from './mapper.js';

interface SeedDocument {
  collection: string;
  id: number | string;
  data: Record<string, unknown>;
  preserve?: string[];
}
const counters = [
  'paciente',
  'expediente',
  'responsable',
  'consulta',
  'diagnostico',
  'tratamiento',
  'receta',
  'receta_folio',
];

function assertSeedTarget(options: FirestoreOptions): void {
  const realProject =
    process.env.FIRESTORE_MODE === 'real' &&
    Boolean(options.projectId) &&
    options.projectId === process.env.GCLOUD_PROJECT &&
    options.projectId !== 'demo-genki-health' &&
    !/^demo-[a-z0-9-]+$/.test(options.projectId);
  if (
    options.id_institucion !== 4 ||
    options.kind !== 'clinica_odontologica' ||
    (options.projectId !== 'demo-genki-health' && !realProject)
  )
    throw new Error('Seed requires the fixed demo institution/project');
}

/** Demo-only native bootstrap uses the existing buffered transaction boundary. */
export async function seedFirebase(options: FirestoreOptions, rows: SeedDocument[]): Promise<void> {
  assertSeedTarget(options);
  const uow = new FirebaseUnitOfWork(options);
  try {
    await uow.runInTransaction(async () => {
      for (const { collection, id, data, preserve = [] } of rows) {
        const current = await uow.read(collection, id);
        if (current) {
          for (const [key, value] of Object.entries(data)) {
            if (!preserve.includes(key) && JSON.stringify(current[key]) !== JSON.stringify(value))
              throw new Error(`Seed fixture conflict in ${collection}`);
          }
        } else {
          // documentKeys reservation plus patient plus record commit atomically.
          if (collection === 'patients') {
            const matches = await uow.query(
              'patients',
              (row) => row.numero_documento === data.numero_documento,
            );
            if (matches.length)
              throw new Error('Seed natural document key already has a different ID');
          }
          await uow.create(collection, id, data);
        }
        if (collection === 'patients') {
          const key = documentKey(String(data.numero_documento));
          const reservation = await uow.read('documentKeys', key);
          if (
            reservation &&
            (reservation.id_paciente !== id ||
              reservation.numero_documento !== data.numero_documento)
          )
            throw new Error('Seed document key conflict');
          if (!reservation)
            await uow.create('documentKeys', key, {
              id_paciente: id,
              numero_documento: data.numero_documento,
            });
        }
      }
      let maximum = 103;
      const inspect = (value: unknown): void => {
        if (Array.isArray(value)) {
          value.forEach(inspect);
          return;
        }
        if (!value || typeof value !== 'object') return;
        for (const [key, item] of Object.entries(value)) {
          if (key.startsWith('id_') && typeof item === 'number') maximum = Math.max(maximum, item);
          if (key === 'folio' && typeof item === 'string' && /^REC-\d+$/.test(item))
            maximum = Math.max(maximum, Number(item.slice(4)));
          inspect(item);
        }
      };
      for (const name of ['patients', 'records', 'responsibles', 'consultations'])
        (await uow.query(name)).forEach(inspect);
      for (const name of counters) {
        const current = await uow.read('counters', name);
        const next = Math.max(Number(current?.next ?? 1), maximum + 1);
        if (!Number.isSafeInteger(next) || next < 1) throw new Error('Seed counter exhausted');
        if (!current || current.next < next) uow.set('counters', name, { next });
      }
    });
  } finally {
    await uow.close();
  }
}

/** Static snapshot only after clinical history/archive completes, never presented as live reporting. */
export async function seedFirebaseReport(options: FirestoreOptions): Promise<void> {
  assertSeedTarget(options);
  const uow = new FirebaseUnitOfWork(options);
  try {
    await uow.runInTransaction(async () => {
      if (await uow.read('reportes', 'resumen')) return;
      const records = await uow.query('records');
      await uow.create('reportes', 'resumen', {
        pacientes_activos: records.filter((row) => row.estado === 'activo').length,
        pacientes_archivados: records.filter((row) => row.estado === 'archivado').length,
      });
    });
  } finally {
    await uow.close();
  }
}

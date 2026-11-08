import { AsyncLocalStorage } from 'node:async_hooks';
import { randomUUID } from 'node:crypto';
import { deleteApp, initializeApp, type App } from 'firebase-admin/app';
import {
  getFirestore,
  type DocumentData,
  type DocumentReference,
  type Firestore,
  type Transaction,
} from 'firebase-admin/firestore';
import type { FirestoreOptions, PersistenceCheckpoint, UnitOfWorkPort } from '../../ports/index.js';
import { fromFirestore, integerId, toFirestore } from './mapper.js';

const collections = new Set([
  'patients',
  'records',
  'responsibles',
  'consultations',
  'municipios',
  'professionals',
  'medications',
  'cie10',
  'documentKeys',
  'counters',
  'reportes',
]);
type Row = DocumentData;
interface Intent {
  ref: DocumentReference;
  kind: 'create' | 'set' | 'update';
  data: Row;
  checkpoints: PersistenceCheckpoint[];
}
interface Context {
  transaction: Transaction;
  reads: Map<string, Promise<Row | null>>;
  queries: Map<string, Promise<Map<string, Row>>>;
  writes: Map<string, Intent>;
  allocations: Map<string, Promise<number>>;
  phase: 'reading' | 'flushing' | 'closed';
}

/** One instance per institution; only this boundary owns native transaction writes. */
export class FirebaseUnitOfWork implements UnitOfWorkPort {
  private readonly storage = new AsyncLocalStorage<Context>();
  private readonly app: App;
  private readonly db: Firestore;
  private readonly root: string;

  constructor(private readonly options: FirestoreOptions) {
    const { projectId, emulatorHost } = options;
    if (
      !/^demo-[a-z0-9-]+$/.test(projectId) ||
      !/^(127\.0\.0\.1|localhost|\[::1\]):[0-9]+$/.test(emulatorHost) ||
      process.env.FIRESTORE_EMULATOR_HOST !== emulatorHost
    ) {
      throw new Error(
        'Explicit demo project and matching loopback FIRESTORE_EMULATOR_HOST required',
      );
    }
    this.root = `institutions/${integerId(options.id_institucion)}`;
    this.app = initializeApp({ projectId }, `genki-firestore-${randomUUID()}`);
    this.db = getFirestore(this.app);
    this.db.settings({ host: emulatorHost, ssl: false });
  }

  async close(): Promise<void> {
    await this.db.terminate();
    await deleteApp(this.app);
  }

  async runInTransaction<T>(work: () => Promise<T>): Promise<T> {
    const joined = this.storage.getStore();
    if (joined) {
      this.assertReading(joined);
      return work();
    }
    return this.db.runTransaction(
      async (transaction) => {
        const context: Context = {
          transaction,
          reads: new Map(),
          queries: new Map(),
          writes: new Map(),
          allocations: new Map(),
          phase: 'reading',
        };
        return this.storage.run(context, async () => {
          try {
            const result = await work();
            // Counter reads and every other native read have completed before this point.
            await Promise.all([...context.reads.values(), ...context.queries.values()]);
            context.phase = 'flushing';
            for (const intent of context.writes.values()) {
              if (intent.kind === 'create') transaction.create(intent.ref, intent.data);
              else if (intent.kind === 'update') transaction.update(intent.ref, intent.data);
              else transaction.set(intent.ref, intent.data);
              for (const point of intent.checkpoints) this.options.afterWrite?.(point);
            }
            return result;
          } finally {
            context.phase = 'closed';
          }
        });
      },
      { maxAttempts: 3 },
    );
  }

  private assertReading(context: Context): void {
    if (context.phase !== 'reading') throw new Error('Firestore transaction is no longer readable');
  }

  private context(): Context {
    const context = this.storage.getStore();
    if (!context) throw new Error('Firestore write requires runInTransaction');
    this.assertReading(context);
    return context;
  }

  private reference(collection: string, id: string | number): DocumentReference {
    const key = String(id);
    if (!collections.has(collection) || !key || key.includes('/') || key === '.' || key === '..') {
      throw new Error('Invalid institution-local Firestore path');
    }
    return this.db.doc(`${this.root}/${collection}/${key}`);
  }

  async read(collection: string, id: string | number): Promise<Row | null> {
    if (!this.storage.getStore()) return this.runInTransaction(() => this.read(collection, id));
    const context = this.context();
    const ref = this.reference(collection, id);
    const staged = context.writes.get(ref.path);
    if (staged) return structuredClone(staged.data);
    let read = context.reads.get(ref.path);
    if (!read) {
      read = context.transaction
        .get(ref)
        .then((snapshot) => (snapshot.exists ? (fromFirestore(snapshot.data()) as Row) : null));
      context.reads.set(ref.path, read);
    }
    return structuredClone(await read);
  }

  /** Merge the complete collection before filtering, so updates can enter/leave a query. */
  async query(
    collection: string,
    matches: (row: Row) => boolean = () => true,
    historyExpediente?: number,
  ): Promise<Row[]> {
    if (!this.storage.getStore())
      return this.runInTransaction(() => this.query(collection, matches, historyExpediente));
    const context = this.context();
    const parent = this.reference(collection, '_').parent;
    if (historyExpediente !== undefined && collection !== 'consultations') {
      throw new Error('Indexed history requires consultations collection');
    }
    const nativeQuery =
      historyExpediente === undefined
        ? parent
        : parent
            .where('id_expediente', '==', historyExpediente)
            .orderBy('fecha_hora_inicio', 'desc')
            .orderBy('id_consulta', 'desc');
    const cacheKey = `${parent.path}:${historyExpediente ?? '*'}`;
    let query = context.queries.get(cacheKey);
    if (!query) {
      query = context.transaction.get(nativeQuery).then(async (snapshot) => {
        const rows = new Map<string, Row>();
        for (const doc of snapshot.docs) {
          if (!context.reads.has(doc.ref.path)) {
            context.reads.set(doc.ref.path, Promise.resolve(fromFirestore(doc.data()) as Row));
          }
          const row = await context.reads.get(doc.ref.path);
          if (row) rows.set(doc.ref.path, row);
        }
        return rows;
      });
      context.queries.set(cacheKey, query);
    }
    const rows = new Map(await query);
    for (const [path, intent] of context.writes) {
      if (intent.ref.parent.path === parent.path) rows.set(path, intent.data);
    }
    return [...rows.values()]
      .filter((row) => historyExpediente === undefined || row.id_expediente === historyExpediente)
      .map((row) => structuredClone(row))
      .filter(matches);
  }

  /** Serialize allocations even when one callback requests the same counter concurrently. */
  async nextCounter(sequence: string): Promise<number> {
    return this.runInTransaction(async () => {
      const context = this.context();
      const previous = context.allocations.get(sequence);
      const allocation = (async () => {
        if (previous) await previous;
        const counter = await this.read('counters', sequence);
        const id = integerId(counter ? counter.next : 1);
        integerId(id + 1);
        this.set('counters', sequence, { next: id + 1 });
        return id;
      })();
      context.allocations.set(sequence, allocation);
      return allocation;
    });
  }

  async create(
    collection: string,
    id: string | number,
    data: Row,
    point?: PersistenceCheckpoint,
  ): Promise<void> {
    this.context();
    if (await this.read(collection, id)) throw new Error('Firestore document already exists');
    this.stage(collection, id, 'create', data, point);
  }

  set(collection: string, id: string | number, data: Row, point?: PersistenceCheckpoint): void {
    this.stage(collection, id, 'set', data, point);
  }

  async update(
    collection: string,
    id: string | number,
    patch: Row,
    point?: PersistenceCheckpoint,
  ): Promise<void> {
    const row = await this.read(collection, id);
    if (!row) throw new Error('Firestore document not found');
    this.stage(collection, id, 'update', { ...row, ...patch }, point);
  }

  private stage(
    collection: string,
    id: string | number,
    kind: Intent['kind'],
    data: Row,
    point?: PersistenceCheckpoint,
  ): void {
    const context = this.context();
    const ref = this.reference(collection, id);
    const previous = context.writes.get(ref.path);
    const checkpoints = [...(previous?.checkpoints ?? []), ...(point ? [point] : [])];
    context.writes.set(ref.path, {
      ref,
      kind: previous?.kind ?? kind,
      data: toFirestore(data) as Row,
      checkpoints,
    });
  }
}

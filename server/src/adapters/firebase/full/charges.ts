import { AsyncLocalStorage } from 'node:async_hooks';
import type { Firestore, DocumentData, Transaction } from 'firebase-admin/firestore';
import { ChargesService } from '../../../application/full/charges.js';
import {
  ECONOMIC_TABLES,
  type EconomicStore,
  type EconomicReferences,
  type EconomicTransaction,
  type EconomicTable,
} from '../../../ports/full/charges.js';
/** Independent native buffered UoW; does not modify the locked core Firebase UoW. */
export class FirebaseEconomicStore implements EconomicStore {
  private readonly active = new AsyncLocalStorage<EconomicTransaction>();
  constructor(
    private readonly db: Firestore,
    readonly institution: number,
    private readonly references: EconomicReferences | ((native: Transaction) => EconomicReferences),
  ) {}
  transaction<T>(work: (tx: EconomicTransaction) => Promise<T>): Promise<T> {
    const joined = this.active.getStore();
    if (joined) return work(joined);
    return this.db.runTransaction(
      async (native) => {
        const root = this.db.doc(`institutions/${this.institution}`);
        const lock = root.collection('lane_a_locks').doc('ledger');
        const lockSnapshot = await native.get(lock);
        const writes = new Map<
          string,
          { ref: FirebaseFirestore.DocumentReference; data: DocumentData }
        >();
        const collection = (table: EconomicTable) => {
          if (!ECONOMIC_TABLES.includes(table)) throw new Error('Invalid economic table');
          return root.collection(`lane_a_${table}`);
        };
        const document = (table: EconomicTable, key: string | number) => {
          const id = String(key);
          if (!id || id.length > 200 || id.includes('/') || id === '.' || id === '..')
            throw new Error('Invalid economic key');
          return collection(table).doc(id);
        };
        const references =
          typeof this.references === 'function' ? this.references(native) : this.references;
        const tx: EconomicTransaction = {
          get: async <V>(table: EconomicTable, key: string | number) => {
            const ref = document(table, key);
            const staged = writes.get(ref.path);
            if (staged) return structuredClone(staged.data.value) as V;
            const snap = await native.get(ref);
            return snap.exists ? (snap.data()!.value as V) : null;
          },
          list: async <V>(table: EconomicTable) => {
            const col = collection(table),
              snapshot = await native.get(col);
            const rows = new Map(snapshot.docs.map((doc) => [doc.ref.path, doc.data().value as V]));
            for (const [path, write] of writes)
              if (write.ref.parent.path === col.path)
                rows.set(path, structuredClone(write.data.value) as V);
            return [...rows.values()];
          },
          put: async <V>(table: EconomicTable, key: string | number, value: V) => {
            const ref = document(table, key);
            writes.set(ref.path, { ref, data: { value: JSON.parse(JSON.stringify(value)) } });
          },
          patient: (id) => references.patient(id),
          act: (kind, id) => references.act(kind, id),
        };
        const result = await this.active.run(tx, () => work(tx));
        native.set(lock, { revision: Number(lockSnapshot.data()?.revision ?? 0) + 1 });
        for (const { ref, data } of writes.values()) native.set(ref, data);
        return result;
      },
      { maxAttempts: 5 },
    );
  }
}
export class FirebaseChargesRepository extends ChargesService {}

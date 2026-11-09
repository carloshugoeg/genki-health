import type { Firestore } from 'firebase-admin/firestore';
import type { CITA } from '@genki/shared/full/agenda';
import type { AgendaStore, AgendaTransaction } from '../../../ports/full/agenda.js';
import { AgendaApplication, type AgendaOptions } from '../../../application/full/agenda.js';

export class FirebaseAgendaStore implements AgendaStore {
  constructor(private readonly firestore: Firestore) {}
  private collection(institution: number) {
    return this.firestore.collection(`instituciones/${institution}/agenda_cita`);
  }
  async list(institution: number): Promise<CITA[]> {
    return (await this.collection(institution).get()).docs.map((doc) => doc.data() as CITA);
  }
  async transaction<T>(
    institution: number,
    keys: readonly string[],
    work: (tx: AgendaTransaction) => Promise<T>,
  ): Promise<T> {
    return this.firestore.runTransaction(async (native) => {
      // All reads precede writes, including locks, for Firestore transaction semantics.
      const refs = [...new Set(keys)]
        .sort()
        .map((key) =>
          this.firestore.doc(`instituciones/${institution}/agenda_lock/${encodeURIComponent(key)}`),
        );
      if (refs.length) await native.getAll(...refs);
      const counterRef = this.firestore.doc('agenda_meta/cita');
      const counterSnapshot = await native.get(counterRef);
      let nextId = Number(counterSnapshot.data()?.value ?? 0);
      const snapshot = await native.get(this.collection(institution));
      const rows = snapshot.docs.map((doc) => doc.data() as CITA);
      const result = await work({
        list: async () => structuredClone(rows),
        nextId: async () => {
          nextId++;
          native.set(counterRef, { value: nextId });
          return nextId;
        },
        put: async (c) => {
          native.set(this.collection(institution).doc(String(c.id_cita)), c);
        },
      });
      for (const ref of refs) native.set(ref, { touched: true });
      return result;
    });
  }
}
export class FirebaseAgendaRepository extends AgendaApplication {
  constructor(firestore: Firestore, options: AgendaOptions = {}) {
    super(new FirebaseAgendaStore(firestore), options);
  }
}

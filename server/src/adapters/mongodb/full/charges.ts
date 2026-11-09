import type { MongoClient, Db } from 'mongodb';
import { ChargesService } from '../../../application/full/charges.js';
import {
  ECONOMIC_TABLES,
  type EconomicStore,
  type EconomicReferences,
  type EconomicTransaction,
  type EconomicTable,
} from '../../../ports/full/charges.js';
import { MongoUnitOfWork, activeMongoSession } from '../unit-of-work.js';
interface LedgerDocument {
  _id: string;
  institution: number;
  data: unknown;
}
export class MongodbEconomicStore implements EconomicStore {
  private readonly uow: MongoUnitOfWork;
  constructor(
    client: MongoClient,
    private readonly db: Db,
    readonly institution: number,
    private readonly references: EconomicReferences,
  ) {
    this.uow = new MongoUnitOfWork(client, db);
  }
  /** Safe to rerun. Initialize the lock outside transactions; never reset economic data. */
  async migrate(): Promise<void> {
    for (const table of [...ECONOMIC_TABLES, 'locks']) {
      const collection = this.db.collection<LedgerDocument>(`lane_a_${table}`);
      await collection.createIndex({ institution: 1 });
    }
    await this.db
      .collection('lane_a_locks')
      .updateOne(
        { _id: String(this.institution) as never },
        { $setOnInsert: { revision: 0 } },
        { upsert: true },
      );
  }
  transaction<T>(work: (tx: EconomicTransaction) => Promise<T>): Promise<T> {
    return this.uow.runInTransaction(async () => {
      const session = activeMongoSession()!;
      const lock = await this.db
        .collection('lane_a_locks')
        .updateOne(
          { _id: String(this.institution) as never },
          { $inc: { revision: 1 } },
          { session },
        );
      if (lock.matchedCount !== 1) throw new Error('Run lane A Mongo migration first');
      const collection = (table: EconomicTable) => {
        if (!ECONOMIC_TABLES.includes(table)) throw new Error('Invalid economic table');
        return this.db.collection<LedgerDocument>(`lane_a_${table}`);
      };
      const key = (id: string | number) => `${this.institution}:${id}`;
      const tx: EconomicTransaction = {
        get: async <V>(table: EconomicTable, id: string | number) => {
          const row = await collection(table).findOne(
            { _id: key(id), institution: this.institution },
            { session },
          );
          return (row?.data ?? null) as V | null;
        },
        list: async <V>(table: EconomicTable) =>
          (
            await collection(table)
              .find({ institution: this.institution }, { session })
              .sort({ _id: 1 })
              .toArray()
          ).map((r) => r.data as V),
        put: async <V>(table: EconomicTable, id: string | number, data: V) => {
          await collection(table).replaceOne(
            { _id: key(id), institution: this.institution },
            { institution: this.institution, data },
            { session, upsert: true },
          );
        },
        patient: (id) => this.references.patient(id),
        act: (kind, id) => this.references.act(kind, id),
      };
      return work(tx);
    });
  }
}
export class MongodbChargesRepository extends ChargesService {}

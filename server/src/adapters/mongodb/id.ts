import type { Db, FindOptions, InsertOneOptions, UpdateOptions } from 'mongodb';
import type { IdPort } from '../../ports/index.js';
import { makeDocumentId, toBsonInt, type MongoStringIdDoc } from './mapper.js';
import { activeMongoSession } from './unit-of-work.js';

function sessionOpts():
  | Pick<FindOptions, 'session'>
  | Pick<InsertOneOptions, 'session'>
  | Pick<UpdateOptions, 'session'>
  | Record<string, never> {
  const session = activeMongoSession();
  return session ? { session } : {};
}

/**
 * Counter allocation inside the current Mongo session (C3.3).
 * Counter `_id` is `<institution>:<name>`; `next` is BSON Int32.
 */
export class MongoIdPort implements IdPort {
  constructor(
    private readonly db: Db,
    private readonly institutionId: number,
  ) {}

  async nextInt(sequence: string): Promise<number> {
    const coll = this.db.collection<MongoStringIdDoc>('counters');
    const _id = makeDocumentId(this.institutionId, sequence);
    const opts = sessionOpts();

    for (;;) {
      const existing = await coll.findOne({ _id }, opts);
      if (!existing) {
        try {
          await coll.insertOne(
            {
              _id,
              institution_id: toBsonInt(this.institutionId),
              name: sequence,
              next: toBsonInt(2),
            },
            opts,
          );
          return 1;
        } catch (error) {
          const code = (error as { code?: number }).code;
          if (code === 11000) {
            continue;
          }
          throw error;
        }
      }

      const current = Number(existing.next);
      const updated = await coll.findOneAndUpdate(
        { _id, next: existing.next },
        { $set: { next: toBsonInt(current + 1) } },
        { returnDocument: 'after', ...opts },
      );
      if (updated) {
        return current;
      }
    }
  }
}

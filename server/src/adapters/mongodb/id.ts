import type { Db } from 'mongodb';
import type { IdPort } from '../../ports/index.js';
import { makeDocumentId, toBsonInt } from './mapper.js';
import { activeMongoSession } from './unit-of-work.js';

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
    const session = activeMongoSession();
    const coll = this.db.collection('counters');
    const _id = makeDocumentId(this.institutionId, sequence);

    for (;;) {
      const existing = await coll.findOne({ _id }, { session });
      if (!existing) {
        try {
          await coll.insertOne(
            {
              _id,
              institution_id: toBsonInt(this.institutionId),
              name: sequence,
              next: toBsonInt(2),
            },
            { session },
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
        { returnDocument: 'after', session },
      );
      if (updated) {
        return current;
      }
    }
  }
}

import { AsyncLocalStorage } from 'node:async_hooks';
import type { ClientSession, Db, MongoClient } from 'mongodb';
import type { UnitOfWorkPort } from '../../ports/index.js';

const mongoTx = new AsyncLocalStorage<ClientSession>();

export function activeMongoSession(): ClientSession | undefined {
  return mongoTx.getStore();
}

function isTransientTransactionError(error: unknown): boolean {
  if (!error || typeof error !== 'object') {
    return false;
  }
  const labeled = error as { hasErrorLabel?: (label: string) => boolean };
  if (typeof labeled.hasErrorLabel === 'function') {
    return (
      labeled.hasErrorLabel('TransientTransactionError') ||
      labeled.hasErrorLabel('UnknownTransactionCommitResult')
    );
  }
  return false;
}

/**
 * Replica-set unit of work (C3.3 Mongo): snapshot read concern, majority write
 * concern, nested joins via ALS, at most three transient retries, always end session.
 */
export class MongoUnitOfWork implements UnitOfWorkPort {
  constructor(
    private readonly client: MongoClient,
    private readonly db: Db,
  ) {
    void this.db;
  }

  async runInTransaction<T>(work: () => Promise<T>): Promise<T> {
    const existing = mongoTx.getStore();
    if (existing) {
      return work();
    }

    const session = this.client.startSession();
    try {
      let lastError: unknown;
      for (let attempt = 0; attempt < 3; attempt += 1) {
        try {
          session.startTransaction({
            readConcern: { level: 'snapshot' },
            writeConcern: { w: 'majority' },
          });
          const result = await mongoTx.run(session, work);
          await session.commitTransaction();
          return result;
        } catch (error) {
          if (session.inTransaction()) {
            await session.abortTransaction().catch(() => undefined);
          }
          lastError = error;
          if (!isTransientTransactionError(error) || attempt === 2) {
            throw error;
          }
        }
      }
      throw lastError;
    } finally {
      await session.endSession();
    }
  }
}

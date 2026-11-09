import { AsyncLocalStorage } from 'node:async_hooks';
import type pg from 'pg';
import type { UnitOfWorkPort } from '../../ports/index.js';

const postgresTx = new AsyncLocalStorage<pg.PoolClient>();

let boundPool: pg.Pool | undefined;

/** Bind the process pool used when no transaction client is active. */
export function bindPostgresPool(pool: pg.Pool): void {
  boundPool = pool;
}

export function activePostgresClient(): pg.PoolClient | undefined {
  return postgresTx.getStore();
}

export async function postgresQuery<T extends pg.QueryResultRow = pg.QueryResultRow>(
  text: string,
  params?: unknown[],
): Promise<pg.QueryResult<T>> {
  const tx = postgresTx.getStore();
  if (tx) {
    return tx.query<T>(text, params);
  }
  if (!boundPool) {
    throw new Error('postgres pool not bound');
  }
  return boundPool.query<T>(text, params);
}

/**
 * PostgreSQL unit of work (C3.3): pool client, BEGIN, ALS scope, nested joins,
 * COMMIT on success, ROLLBACK then release in finally. Isolation READ COMMITTED.
 */
export class PostgresUnitOfWork implements UnitOfWorkPort {
  constructor(private readonly pool: pg.Pool) {
    bindPostgresPool(pool);
  }

  async runInTransaction<T>(work: () => Promise<T>): Promise<T> {
    const existing = postgresTx.getStore();
    if (existing) {
      return work();
    }

    const client = await this.pool.connect();
    try {
      await client.query('BEGIN ISOLATION LEVEL READ COMMITTED');
      const result = await postgresTx.run(client, work);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      try {
        await client.query('ROLLBACK');
      } catch {
        // Client may already be aborted; still release below.
      }
      throw error;
    } finally {
      client.release();
    }
  }
}

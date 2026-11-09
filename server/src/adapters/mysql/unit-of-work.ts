import { AsyncLocalStorage } from 'node:async_hooks';
import type { Pool, PoolConnection } from 'mysql2/promise';
import type { UnitOfWorkPort } from '../../ports/index.js';

const mysqlTx = new AsyncLocalStorage<PoolConnection>();

let boundPool: Pool | undefined;

/** Bind the process pool used when no transaction connection is active. */
export function bindMysqlPool(pool: Pool): void {
  boundPool = pool;
}

export function activeMysqlConnection(): PoolConnection | undefined {
  return mysqlTx.getStore();
}

export async function mysqlQuery<T = unknown>(
  sql: string,
  params?: unknown[],
): Promise<[T, unknown]> {
  const tx = mysqlTx.getStore();
  if (tx) {
    return tx.query(sql, params) as Promise<[T, unknown]>;
  }
  if (!boundPool) {
    throw new Error('mysql pool not bound');
  }
  return boundPool.query(sql, params) as Promise<[T, unknown]>;
}

/**
 * MySQL unit of work (C3.3): pool connection, beginTransaction, ALS scope,
 * nested joins, COMMIT on success, ROLLBACK then release in finally.
 * Isolation READ COMMITTED; session time_zone +00:00.
 */
export class MysqlUnitOfWork implements UnitOfWorkPort {
  constructor(private readonly pool: Pool) {
    bindMysqlPool(pool);
  }

  async runInTransaction<T>(work: () => Promise<T>): Promise<T> {
    const existing = mysqlTx.getStore();
    if (existing) {
      return work();
    }

    const connection = await this.pool.getConnection();
    try {
      await connection.query(`SET time_zone = '+00:00'`);
      await connection.query(`SET SESSION TRANSACTION ISOLATION LEVEL READ COMMITTED`);
      await connection.beginTransaction();
      const result = await mysqlTx.run(connection, work);
      await connection.commit();
      return result;
    } catch (error) {
      try {
        await connection.rollback();
      } catch {
        // Connection may already be aborted; still release below.
      }
      throw error;
    } finally {
      connection.release();
    }
  }
}

import { mysqlQuery } from '../unit-of-work.js';

/** Normalize mysql2 query results to a postgres-like `{ rows }` shape. */
export async function mysqlQueryResult<T extends Record<string, unknown>>(
  sql: string,
  params?: unknown[],
): Promise<{ rows: T[] }> {
  const [result] = await mysqlQuery(sql, params);
  if (Array.isArray(result)) {
    return { rows: result as T[] };
  }
  return { rows: [] };
}

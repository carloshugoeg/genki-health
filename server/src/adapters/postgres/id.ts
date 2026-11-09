import type { IdPort } from '../../ports/index.js';
import { activePostgresClient } from './unit-of-work.js';

/**
 * SQL id allocation (C3.3): row ids stay IDENTITY; only `receta_folio` uses
 * the atomic `id_counter` row inside the current transaction.
 */
export class PostgresIdPort implements IdPort {
  async nextInt(sequence: string): Promise<number> {
    const client = activePostgresClient();
    if (!client) {
      throw new Error('id allocation requires an active postgres transaction');
    }
    if (sequence !== 'receta_folio') {
      throw new Error(`unsupported postgres counter sequence: ${sequence}`);
    }

    const result = await client.query<{ allocated: number }>(
      `UPDATE id_counter
          SET siguiente = siguiente + 1
        WHERE nombre = $1
        RETURNING (siguiente - 1) AS allocated`,
      [sequence],
    );
    const allocated = result.rows[0]?.allocated;
    if (typeof allocated !== 'number') {
      throw new Error(`id_counter row missing for ${sequence}`);
    }
    return allocated;
  }
}

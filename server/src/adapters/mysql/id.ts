import type { RowDataPacket } from 'mysql2';
import type { IdPort } from '../../ports/index.js';
import { activeMysqlConnection } from './unit-of-work.js';

/**
 * SQL id allocation (C3.3): row ids stay AUTO_INCREMENT; only `receta_folio`
 * uses the atomic `id_counter` row inside the current transaction.
 */
export class MysqlIdPort implements IdPort {
  async nextInt(sequence: string): Promise<number> {
    const connection = activeMysqlConnection();
    if (!connection) {
      throw new Error('id allocation requires an active mysql transaction');
    }
    if (sequence !== 'receta_folio') {
      throw new Error(`unsupported mysql counter sequence: ${sequence}`);
    }

    const [locked] = await connection.query<RowDataPacket[]>(
      `SELECT siguiente FROM id_counter WHERE nombre = ? FOR UPDATE`,
      [sequence],
    );
    const current = locked[0]?.siguiente;
    if (typeof current !== 'number' && typeof current !== 'string') {
      throw new Error(`id_counter row missing for ${sequence}`);
    }
    const allocated = Number(current);
    if (!Number.isInteger(allocated) || allocated <= 0) {
      throw new Error(`id_counter row invalid for ${sequence}`);
    }

    await connection.query(`UPDATE id_counter SET siguiente = siguiente + 1 WHERE nombre = ?`, [
      sequence,
    ]);
    return allocated;
  }
}

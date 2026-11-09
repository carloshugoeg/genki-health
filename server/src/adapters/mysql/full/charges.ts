import type { Pool, RowDataPacket } from 'mysql2/promise';
import { ChargesService } from '../../../application/full/charges.js';
import {
  ECONOMIC_TABLES,
  type EconomicStore,
  type EconomicReferences,
  type EconomicTransaction,
  type EconomicTable,
} from '../../../ports/full/charges.js';
import { MysqlUnitOfWork, activeMysqlConnection } from '../unit-of-work.js';
const tableName = (table: EconomicTable) => {
  if (!ECONOMIC_TABLES.includes(table)) throw new Error('Invalid economic table');
  return `lane_a_${table}`;
};
export class MysqlEconomicStore implements EconomicStore {
  private readonly uow: MysqlUnitOfWork;
  constructor(
    pool: Pool,
    readonly institution: number,
    private readonly references: EconomicReferences,
  ) {
    this.uow = new MysqlUnitOfWork(pool);
  }
  transaction<T>(work: (tx: EconomicTransaction) => Promise<T>): Promise<T> {
    return this.uow.runInTransaction(async () => {
      const client = activeMysqlConnection()!;
      await client.query(
        "INSERT INTO lane_a_locks (institution,row_key,data) VALUES (?,'ledger','{}') ON DUPLICATE KEY UPDATE row_key=row_key",
        [this.institution],
      );
      await client.query(
        "SELECT data FROM lane_a_locks WHERE institution=? AND row_key='ledger' FOR UPDATE",
        [this.institution],
      );
      const institution = this.institution;
      const parse = <V>(data: unknown): V =>
        (typeof data === 'string' ? JSON.parse(data) : data) as V;
      const tx: EconomicTransaction = {
        get: async <V>(table: EconomicTable, key: string | number) => {
          const [rows] = await client.query<RowDataPacket[]>(
            `SELECT data FROM ${tableName(table)} WHERE institution=? AND row_key=?`,
            [institution, String(key)],
          );
          return rows.length ? parse<V>(rows[0]!.data) : null;
        },
        list: async <V>(table: EconomicTable) => {
          const [rows] = await client.query<RowDataPacket[]>(
            `SELECT data FROM ${tableName(table)} WHERE institution=? ORDER BY row_key`,
            [institution],
          );
          return rows.map((row) => parse<V>(row.data));
        },
        put: async <V>(table: EconomicTable, key: string | number, value: V) => {
          await client.query(
            `INSERT INTO ${tableName(table)} (institution,row_key,data) VALUES (?,?,?) ON DUPLICATE KEY UPDATE data=VALUES(data)`,
            [institution, String(key), JSON.stringify(value)],
          );
        },
        patient: (id) => this.references.patient(id),
        act: (kind, id) => this.references.act(kind, id),
      };
      return work(tx);
    });
  }
}
export class MysqlChargesRepository extends ChargesService {}

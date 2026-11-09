import type pg from 'pg';
import { ChargesService } from '../../../application/full/charges.js';
import {
  ECONOMIC_TABLES,
  type EconomicStore,
  type EconomicReferences,
  type EconomicTransaction,
  type EconomicTable,
} from '../../../ports/full/charges.js';
import { PostgresUnitOfWork, activePostgresClient } from '../unit-of-work.js';
const tableName = (table: EconomicTable) => {
  if (!ECONOMIC_TABLES.includes(table)) throw new Error('Invalid economic table');
  return `lane_a_${table}`;
};
/** A row lock serializes the institution economic ledger; all modules join its native UoW. */
export class PostgresEconomicStore implements EconomicStore {
  private readonly uow: PostgresUnitOfWork;
  constructor(
    pool: pg.Pool,
    readonly institution: number,
    private readonly references: EconomicReferences,
  ) {
    this.uow = new PostgresUnitOfWork(pool);
  }
  transaction<T>(work: (tx: EconomicTransaction) => Promise<T>): Promise<T> {
    return this.uow.runInTransaction(async () => {
      const client = activePostgresClient()!;
      await client.query(
        "INSERT INTO lane_a_locks (institution,row_key,data) VALUES ($1,'ledger','{}') ON CONFLICT DO NOTHING",
        [this.institution],
      );
      await client.query(
        "SELECT data FROM lane_a_locks WHERE institution=$1 AND row_key='ledger' FOR UPDATE",
        [this.institution],
      );
      const institution = this.institution;
      const tx: EconomicTransaction = {
        ...this.references,
        get: async <V>(table: EconomicTable, key: string | number) => {
          const result = await client.query(
            `SELECT data FROM ${tableName(table)} WHERE institution=$1 AND row_key=$2`,
            [institution, String(key)],
          );
          return (result.rows[0]?.data ?? null) as V | null;
        },
        list: async <V>(table: EconomicTable) => {
          const result = await client.query(
            `SELECT data FROM ${tableName(table)} WHERE institution=$1 ORDER BY row_key`,
            [institution],
          );
          return result.rows.map((row) => row.data as V);
        },
        put: async <V>(table: EconomicTable, key: string | number, value: V) => {
          await client.query(
            `INSERT INTO ${tableName(table)} (institution,row_key,data) VALUES ($1,$2,$3::jsonb) ON CONFLICT (institution,row_key) DO UPDATE SET data=EXCLUDED.data`,
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
export class PostgresChargesRepository extends ChargesService {}

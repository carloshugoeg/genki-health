import { AsyncLocalStorage } from 'node:async_hooks';
import { ChargesService } from '../../../application/full/charges.js';
import type {
  EconomicStore,
  EconomicReferences,
  EconomicTransaction,
  EconomicTable,
} from '../../../ports/full/charges.js';
/** Contract tests only. Never selected as a native engine fallback. */
export class MemoryEconomicStore implements EconomicStore {
  private readonly active = new AsyncLocalStorage<EconomicTransaction>();
  private rows = new Map<string, unknown>();
  private tail: Promise<unknown> = Promise.resolve();
  constructor(
    readonly institution: number,
    private readonly references: EconomicReferences,
  ) {}
  transaction<T>(work: (tx: EconomicTransaction) => Promise<T>): Promise<T> {
    const joined = this.active.getStore();
    if (joined) return work(joined);
    const pending = this.tail.then(async () => {
      const draft = structuredClone(this.rows),
        key = (table: EconomicTable, id: string | number) => `${table}:${id}`;
      const tx: EconomicTransaction = {
        get: async <V>(table: EconomicTable, id: string | number) =>
          (structuredClone(draft.get(key(table, id))) ?? null) as V | null,
        list: async <V>(table: EconomicTable) =>
          [...draft.entries()]
            .filter(([k]) => k.startsWith(`${table}:`))
            .map(([, v]) => structuredClone(v) as V),
        put: async <V>(table: EconomicTable, id: string | number, value: V) => {
          draft.set(key(table, id), structuredClone(value));
        },
        patient: (id) => this.references.patient(id),
        act: (kind, id) => this.references.act(kind, id),
      };
      const result = await this.active.run(tx, () => work(tx));
      this.rows = draft;
      return structuredClone(result);
    });
    this.tail = pending.catch(() => undefined);
    return pending;
  }
}
export class MemoryChargesRepository extends ChargesService {}

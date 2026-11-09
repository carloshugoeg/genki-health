import type { CITA } from '@genki/shared/full/agenda';
import type { AgendaStore } from '../../../ports/full/agenda.js';
import { AgendaApplication, type AgendaOptions } from '../../../application/full/agenda.js';
/** Contract fixture only. Never wired into native adapters. */
export class MemoryAgendaStore implements AgendaStore {
  private rows = new Map<number, CITA[]>();
  private tail: Promise<unknown> = Promise.resolve();
  async list(institution: number) {
    return structuredClone(this.rows.get(institution) ?? []);
  }
  transaction<T>(
    institution: number,
    _keys: readonly string[],
    work: Parameters<AgendaStore['transaction']>[2],
  ): Promise<T> {
    const result = this.tail.then(async () => {
      const rows = await this.list(institution);
      let next = rows.reduce((max, c) => Math.max(max, c.id_cita), 0);
      const value = await work({
        list: async () => structuredClone(rows),
        nextId: async () => ++next,
        put: async (cita) => {
          const i = rows.findIndex((c) => c.id_cita === cita.id_cita);
          if (i < 0) rows.push(structuredClone(cita));
          else rows[i] = structuredClone(cita);
        },
      });
      this.rows.set(institution, rows);
      return value as T;
    });
    this.tail = result.catch(() => {});
    return result;
  }
}
export class MemoryAgendaRepository extends AgendaApplication {
  constructor(store = new MemoryAgendaStore(), options: AgendaOptions = {}) {
    super(store, options);
  }
}

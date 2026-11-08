import { AsyncLocalStorage } from 'node:async_hooks';
import type { UnitOfWorkPort } from '../../ports/index.js';
import { cloneMemoryMaps, type MemoryInstitutionState, type MemoryMaps } from './state.js';

interface MemoryTxStore {
  working: MemoryMaps;
}

const memoryTx = new AsyncLocalStorage<MemoryTxStore>();

/** Active maps: working snapshot inside a transaction, else published. */
export function activeMemoryMaps(state: MemoryInstitutionState): MemoryMaps {
  const store = memoryTx.getStore();
  return store ? store.working : state.getPublished();
}

/**
 * Snapshot UoW for memory (C3.3): outer writers take a promise mutex, clone all
 * maps, nest via ALS, publish on success, discard on failure.
 */
export class MemoryUnitOfWork implements UnitOfWorkPort {
  private chain: Promise<unknown> = Promise.resolve();

  constructor(private readonly state: MemoryInstitutionState) {}

  async runInTransaction<T>(work: () => Promise<T>): Promise<T> {
    if (memoryTx.getStore()) {
      return work();
    }

    const run = this.chain.then(() => this.runOuter(work));
    this.chain = run.then(
      () => undefined,
      () => undefined,
    );
    return run;
  }

  private async runOuter<T>(work: () => Promise<T>): Promise<T> {
    const working = cloneMemoryMaps(this.state.getPublished());
    const result = await memoryTx.run({ working }, work);
    this.state.publish(working);
    return result;
  }
}

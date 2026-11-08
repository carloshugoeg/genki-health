import { AsyncLocalStorage } from 'node:async_hooks';
import type { UnitOfWorkPort } from '../../ports/index.js';
import { cloneMemoryMaps, type MemoryInstitutionState, type MemoryMaps } from './state.js';

interface MemoryTxStore {
  state: MemoryInstitutionState;
  working: MemoryMaps;
}

const memoryTx = new AsyncLocalStorage<MemoryTxStore>();

export function activeMemoryMaps(state: MemoryInstitutionState): MemoryMaps {
  const store = memoryTx.getStore();
  if (store && store.state === state) {
    return store.working;
  }
  return state.getPublished();
}

export class MemoryUnitOfWork implements UnitOfWorkPort {
  private chain: Promise<unknown> = Promise.resolve();

  constructor(private readonly state: MemoryInstitutionState) {}

  async runInTransaction<T>(work: () => Promise<T>): Promise<T> {
    const store = memoryTx.getStore();
    if (store && store.state === this.state) {
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
    const result = await memoryTx.run({ state: this.state, working }, work);
    this.state.publish(working);
    return result;
  }
}

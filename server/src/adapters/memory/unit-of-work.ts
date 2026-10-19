import type { UnitOfWorkPort } from '../../ports/index.js';

/** In-memory UoW has nothing to roll back yet; preserves the call shape for TDD. */
export class MemoryUnitOfWork implements UnitOfWorkPort {
  async runInTransaction<T>(work: () => Promise<T>): Promise<T> {
    return work();
  }
}

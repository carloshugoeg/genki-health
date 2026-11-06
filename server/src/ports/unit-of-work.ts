/**
 * Transaction boundary abstraction. Closing a consultation writes consultation,
 * diagnoses, treatments, and prescription in one transaction (locked).
 */
export interface UnitOfWorkPort {
  runInTransaction<T>(work: () => Promise<T>): Promise<T>;
}

import type { IdPort } from '../../ports/index.js';

export class MemoryIdPort implements IdPort {
  private readonly sequences = new Map<string, number>();

  async nextInt(sequence: string): Promise<number> {
    const current = this.sequences.get(sequence) ?? 0;
    const next = current + 1;
    this.sequences.set(sequence, next);
    return next;
  }
}

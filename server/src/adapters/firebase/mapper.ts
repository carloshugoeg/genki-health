import { createHash } from 'node:crypto';

/** Detached wire values: timestamps are ISO strings and absent values are null. */
export function toFirestore(value: unknown): unknown {
  if (value === undefined || value === null) return null;
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(toFirestore);
  if (typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, toFirestore(item)]));
  }
  if (typeof value === 'number' && !Number.isFinite(value)) {
    throw new Error('Firestore values must be finite');
  }
  return value;
}

export function fromFirestore(value: unknown): unknown {
  if (value && typeof value === 'object' && 'toDate' in value) {
    const timestamp = value as { toDate?: unknown };
    if (typeof timestamp.toDate === 'function') return timestamp.toDate().toISOString();
  }
  if (Array.isArray(value)) return value.map(fromFirestore);
  if (value instanceof Date) return value.toISOString();
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, fromFirestore(item)]),
    );
  }
  return value ?? null;
}

export function integerId(value: unknown): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 1) {
    throw new Error('Expected a positive safe integer');
  }
  return value;
}

export function documentKey(numeroDocumento: string): string {
  return createHash('sha256').update(numeroDocumento.trim().toUpperCase()).digest('hex');
}

import pg from 'pg';

/** DATE OID 1082 → YYYY-MM-DD string (avoid local-midnight Date shifts). */
pg.types.setTypeParser(1082, (value) => value);

/** NUMERIC OID 1700 → string; callers convert with fromPgNumeric. */
pg.types.setTypeParser(1700, (value) => value);

/** Pass calendar dates as YYYY-MM-DD for `$n::date` binds. */
export function toPgDate(yyyyMmDd: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(yyyyMmDd)) {
    throw new Error(`invalid calendar date: ${yyyyMmDd}`);
  }
  return yyyyMmDd;
}

/** Pass UTC instants for `$n::timestamptz` binds. */
export function toPgTimestamptz(isoUtc: string): Date {
  const date = new Date(isoUtc);
  if (Number.isNaN(date.getTime())) {
    throw new Error(`invalid ISO timestamptz: ${isoUtc}`);
  }
  return date;
}

/** Wire DATE columns as YYYY-MM-DD. */
export function fromPgDate(value: Date | string): string {
  if (typeof value === 'string') {
    return value.slice(0, 10);
  }
  return value.toISOString().slice(0, 10);
}

/** Wire TIMESTAMPTZ columns as ISO-8601 Z. */
export function fromPgTimestamptz(value: Date | string): string {
  if (value instanceof Date) {
    return value.toISOString();
  }
  return new Date(value).toISOString();
}

/** Wire NUMERIC/DECIMAL columns as JS numbers for shared DTOs. */
export function fromPgNumeric(value: unknown): number {
  if (typeof value === 'number') {
    return value;
  }
  if (typeof value === 'string' && value.trim() !== '') {
    const n = Number(value);
    if (!Number.isNaN(n)) {
      return n;
    }
  }
  throw new Error('expected numeric');
}

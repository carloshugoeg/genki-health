/** Pass calendar dates as YYYY-MM-DD for DATE binds. */
export function toMysqlDate(yyyyMmDd: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(yyyyMmDd)) {
    throw new Error(`invalid calendar date: ${yyyyMmDd}`);
  }
  return yyyyMmDd;
}

/** Pass UTC instants for DATETIME(3) binds (session time_zone +00:00). */
export function toMysqlDatetime(isoUtc: string): Date {
  const date = new Date(isoUtc);
  if (Number.isNaN(date.getTime())) {
    throw new Error(`invalid ISO datetime: ${isoUtc}`);
  }
  return date;
}

/** Wire DATE columns as YYYY-MM-DD. */
export function fromMysqlDate(value: unknown): string {
  if (typeof value === 'string') {
    return value.slice(0, 10);
  }
  if (value instanceof Date) {
    const y = value.getUTCFullYear();
    const m = String(value.getUTCMonth() + 1).padStart(2, '0');
    const d = String(value.getUTCDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  throw new Error('expected mysql DATE');
}

/** Wire DATETIME(3) columns as ISO-8601 Z. */
export function fromMysqlDatetime(value: unknown): string {
  if (value instanceof Date) {
    return value.toISOString();
  }
  if (typeof value === 'string') {
    return new Date(value.endsWith('Z') ? value : `${value}Z`).toISOString();
  }
  throw new Error('expected mysql DATETIME');
}

/** Wire DECIMAL/NUMERIC columns as JS numbers for shared DTOs. */
export function fromMysqlDecimal(value: unknown): number {
  if (typeof value === 'number') {
    return value;
  }
  if (typeof value === 'string' && value.trim() !== '') {
    const n = Number(value);
    if (!Number.isNaN(n)) {
      return n;
    }
  }
  throw new Error('expected decimal');
}

/** Wire TINYINT(1)/BOOLEAN columns as boolean. */
export function fromMysqlBoolean(value: unknown): boolean {
  if (typeof value === 'boolean') {
    return value;
  }
  if (value === 1 || value === '1') {
    return true;
  }
  if (value === 0 || value === '0') {
    return false;
  }
  throw new Error('expected boolean');
}

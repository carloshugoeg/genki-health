import { Int32 } from 'mongodb';

/** String `_id` documents (`<institution>:<key>`); never ObjectId DTO keys. */
export interface MongoStringIdDoc {
  _id: string;
  [key: string]: unknown;
}

/** BSON Int32 for every numeric id / counter field (C5.1). */
export function toBsonInt(value: number): Int32 {
  return new Int32(value);
}

/** Timestamps as BSON Date; birth/treatment calendar dates stay YYYY-MM-DD strings. */
export function toBsonDate(isoUtc: string): Date {
  const date = new Date(isoUtc);
  if (Number.isNaN(date.getTime())) {
    throw new Error(`invalid ISO date: ${isoUtc}`);
  }
  return date;
}

export function fromBsonDate(value: Date | string): string {
  if (value instanceof Date) {
    return value.toISOString();
  }
  return value;
}

/** Document `_id` is `<institution>:<numeric id>` or `<institution>:<catalog key>`. */
export function makeDocumentId(institutionId: number, key: number | string): string {
  return `${institutionId}:${key}`;
}

export function asPlainInt(value: unknown): number {
  if (typeof value === 'number') {
    return value;
  }
  if (value instanceof Int32) {
    return value.valueOf();
  }
  throw new Error('expected bson int');
}

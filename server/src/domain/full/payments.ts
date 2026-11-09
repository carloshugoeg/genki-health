import { date, ensure } from './charges.js';
export function guatemalaDay(instant: string): string {
  ensure(Number.isFinite(Date.parse(instant)), 'Fecha inválida', 'invalid_query');
  return new Date(Date.parse(instant) - 6 * 60 * 60 * 1000).toISOString().slice(0, 10);
}
export function closingDay(value: string): void {
  date(value);
}

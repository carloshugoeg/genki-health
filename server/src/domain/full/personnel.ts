export { date, ensure, text, positiveId } from './charges.js';
export function overlaps(
  a: string,
  b: string | null | undefined,
  c: string,
  d: string | null | undefined,
): boolean {
  return a < (d ?? '9999-12-31') && c < (b ?? '9999-12-31');
}

export { ensure, positiveId } from './charges.js';
export function lowStock(stock: number, threshold: number): boolean {
  return stock <= threshold;
}

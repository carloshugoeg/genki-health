/** Port declarations for module `invoicing` (F1). Type-only; no implementations. */

import type { OperationContext } from './context.js';
import type { InvoicePreview } from '@genki/shared/full/charges';
import type { FacturaCompleta, FacturaInput } from '@genki/shared/full/invoicing';

export type Op72Request = {
  params: { id: number };
  query: Record<string, never>;
  body: { cargo_ids: number[] };
};
export type Op72Response = InvoicePreview;

export type Op73Request = {
  params: { id: number };
  query: Record<string, never>;
  body: FacturaInput;
};
export type Op73Response = FacturaCompleta;

export interface InvoicingRepositoryPort {
  op72(input: Op72Request, context: OperationContext): Promise<Op72Response>;
  op73(input: Op73Request, context: OperationContext): Promise<Op73Response>;
}

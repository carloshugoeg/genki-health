/** Port declarations for module `history` (F1). Type-only; no implementations. */

import type { OperationContext } from './context.js';
import type { HistoryEvent, Page, PageQuery } from '@genki/shared/full/history';

export type Op14Request = {
  params: { id: number };
  query: PageQuery;
  body: Record<string, never>;
};
export type Op14Response = Page<HistoryEvent>;

export interface HistoryRepositoryPort {
  op14(input: Op14Request, context: OperationContext): Promise<Op14Response>;
}

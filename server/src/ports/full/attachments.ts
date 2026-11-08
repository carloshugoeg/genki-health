/** Port declarations for module `attachments` (F1). Type-only; no implementations. */

import type { OperationContext } from './context.js';
import type { DOCUMENTO_ADJUNTO } from '@genki/shared/full/attachments';

export type Op17Request = {
  params: { id: number };
  query: Record<string, never>;
  body: { archivo: Blob; id_consulta?: number };
};
export type Op17Response = DOCUMENTO_ADJUNTO;

export interface AttachmentsRepositoryPort {
  op17(input: Op17Request, context: OperationContext): Promise<Op17Response>;
}

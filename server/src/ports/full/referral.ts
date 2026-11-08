/** Port declarations for module `referral` (F1). Type-only; no implementations. */

import type { OperationContext } from './context.js';
import type { ORDEN_ESTUDIO, ORDEN_ESTUDIOInput } from '@genki/shared/full/referral';

export type Op39Request = {
  params: { id: number };
  query: Record<string, never>;
  body: { orden: ORDEN_ESTUDIOInput; examenes: string[] };
};
export type Op39Response = ORDEN_ESTUDIO;

export interface ReferralRepositoryPort {
  op39(input: Op39Request, context: OperationContext): Promise<Op39Response>;
}

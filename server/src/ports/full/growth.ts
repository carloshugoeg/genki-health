/** Port declarations for module `growth` (F1). Type-only; no implementations. */

import type { OperationContext } from './context.js';
import type {
  ANTECEDENTE_PERINATAL,
  ANTECEDENTE_PERINATALInput,
  MEDICION_ANTROPOMETRICA,
  MedicionInput,
} from '@genki/shared/full/growth';

export type Op40Request = {
  params: { id: number };
  query: Record<string, never>;
  body: ANTECEDENTE_PERINATALInput;
};
export type Op40Response = ANTECEDENTE_PERINATAL;

export type Op41Request = {
  params: { id: number };
  query: Record<string, never>;
  body: MedicionInput;
};
export type Op41Response = MEDICION_ANTROPOMETRICA;

export type Op42Request = {
  params: { id: number };
  query: Record<string, never>;
  body: Record<string, never>;
};
export type Op42Response = MEDICION_ANTROPOMETRICA[];

export interface GrowthRepositoryPort {
  op40(input: Op40Request, context: OperationContext): Promise<Op40Response>;
  op41(input: Op41Request, context: OperationContext): Promise<Op41Response>;
  op42(input: Op42Request, context: OperationContext): Promise<Op42Response>;
}

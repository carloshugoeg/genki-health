/** Port declarations for module `account` (F1). Type-only; no implementations. */

import type { OperationContext } from './context.js';
import type { AuthTokensDto, LoginRequestDto } from '@genki/shared';

export type Op01Request = {
  params: Record<string, never>;
  query: Record<string, never>;
  body: LoginRequestDto;
};
export type Op01Response = AuthTokensDto;

export type Op02Request = {
  params: Record<string, never>;
  query: Record<string, never>;
  body: { refresh_token: string };
};
export type Op02Response = void;

export type Op03Request = {
  params: Record<string, never>;
  query: Record<string, never>;
  body: { anterior: string; nueva: string };
};
export type Op03Response = void;

export type Op04Request = {
  params: { id: number };
  query: Record<string, never>;
  body: Record<string, never>;
};
export type Op04Response = { temporal: string };

export interface AccountRepositoryPort {
  op01(input: Op01Request, context: OperationContext): Promise<Op01Response>;
  op02(input: Op02Request, context: OperationContext): Promise<Op02Response>;
  op03(input: Op03Request, context: OperationContext): Promise<Op03Response>;
  op04(input: Op04Request, context: OperationContext): Promise<Op04Response>;
}

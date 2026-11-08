/** Port declarations for module `patient` (F1). Type-only; no implementations. */

import type { OperationContext } from './context.js';
import type { SearchPacientesInput } from '../paciente-repository.js';
import type { PacientePage, PacienteResumen, RegisterPacienteRequest } from '@genki/shared';
import type {
  CONTACTO_EMERGENCIA,
  CONTACTO_EMERGENCIAInput,
  PacientePatch,
} from '@genki/shared/full/patient';

export type Op07Request = {
  params: Record<string, never>;
  query: SearchPacientesInput;
  body: Record<string, never>;
};
export type Op07Response = PacientePage;

export type Op08Request = {
  params: Record<string, never>;
  query: Record<string, never>;
  body: RegisterPacienteRequest;
};
export type Op08Response = PacienteResumen;

export type Op09Request = {
  params: { id: number };
  query: Record<string, never>;
  body: PacientePatch;
};
export type Op09Response = PacienteResumen;

export type Op10Request = {
  params: { id: number };
  query: Record<string, never>;
  body: CONTACTO_EMERGENCIAInput;
};
export type Op10Response = CONTACTO_EMERGENCIA;

export type Op11Request = {
  params: Record<string, never>;
  query: Record<string, never>;
  body: RegisterPacienteRequest['responsables'];
};
export type Op11Response = PacienteResumen;

export type Op13Request = {
  params: Record<string, never>;
  query: Record<string, never>;
  body: RegisterPacienteRequest;
};
export type Op13Response = PacienteResumen;

export interface PatientRepositoryPort {
  op07(input: Op07Request, context: OperationContext): Promise<Op07Response>;
  op08(input: Op08Request, context: OperationContext): Promise<Op08Response>;
  op09(input: Op09Request, context: OperationContext): Promise<Op09Response>;
  op10(input: Op10Request, context: OperationContext): Promise<Op10Response>;
  op11(input: Op11Request, context: OperationContext): Promise<Op11Response>;
  op13(input: Op13Request, context: OperationContext): Promise<Op13Response>;
}

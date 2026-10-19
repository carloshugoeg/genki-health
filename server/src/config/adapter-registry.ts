import type { DataEngine, InstitutionId, InstitutionKind } from '@genki/shared';
import { engineForKind } from '@genki/shared';
import type {
  AuthPort,
  ClockPort,
  ConsultaRepositoryPort,
  IdPort,
  PacienteRepositoryPort,
  UnitOfWorkPort,
} from '../ports/index.js';

/**
 * One adapter set per institution session. Business logic never sees the engine.
 * JWT → institutionId resolution is needs-human; callers pass institution explicitly for now.
 */
export interface AdapterSet {
  readonly engine: DataEngine;
  readonly auth: AuthPort;
  readonly clock: ClockPort;
  readonly ids: IdPort;
  readonly unitOfWork: UnitOfWorkPort;
  readonly pacientes: PacienteRepositoryPort;
  /** Filled when consultation memory/SQL adapters land. */
  readonly consultas?: ConsultaRepositoryPort;
}

export type AdapterSetFactory = (institutionId: InstitutionId) => AdapterSet;

export class InstitutionAdapterRegistry {
  private readonly byKind = new Map<InstitutionKind, AdapterSetFactory>();

  register(kind: InstitutionKind, factory: AdapterSetFactory): void {
    const engine = engineForKind(kind);
    this.byKind.set(kind, (institutionId) => {
      const set = factory(institutionId);
      if (set.engine !== engine) {
        throw new Error(`Registry engine mismatch for ${kind}: expected ${engine}`);
      }
      return set;
    });
  }

  resolve(kind: InstitutionKind, institutionId: InstitutionId): AdapterSet {
    const factory = this.byKind.get(kind);
    if (!factory) {
      throw new Error(`No adapter set registered for ${kind}`);
    }
    return factory(institutionId);
  }

  registeredKinds(): InstitutionKind[] {
    return [...this.byKind.keys()];
  }
}

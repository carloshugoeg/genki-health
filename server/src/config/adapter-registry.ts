import type { DataEngine, InstitutionId, InstitutionKind } from '@genki/shared';
import { engineForKind } from '@genki/shared';
import type {
  ClockPort,
  ConsultaRepositoryPort,
  IdPort,
  PacienteRepositoryPort,
  UnitOfWorkPort,
} from '../ports/index.js';

/**
 * One adapter set per institution session. Business logic never sees the engine.
 * JWT middleware resolves kind + institucion_id, then calls resolve().
 * C3.2: cache ONE set per kind+institutionId for the process lifetime.
 */
export interface AdapterSet {
  readonly engine: DataEngine;
  readonly clock: ClockPort;
  readonly ids: IdPort;
  readonly unitOfWork: UnitOfWorkPort;
  readonly pacientes: PacienteRepositoryPort;
  /** Filled when consultation memory/SQL adapters land. */
  readonly consultas?: ConsultaRepositoryPort;
}

export type AdapterSetFactory = (institutionId: InstitutionId) => AdapterSet;

function cacheKey(kind: InstitutionKind, institutionId: InstitutionId): string {
  return `${kind}:${institutionId}`;
}

export class InstitutionAdapterRegistry {
  private readonly byKind = new Map<InstitutionKind, AdapterSetFactory>();
  private readonly cache = new Map<string, AdapterSet>();

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
    const key = cacheKey(kind, institutionId);
    const cached = this.cache.get(key);
    if (cached) {
      return cached;
    }
    const factory = this.byKind.get(kind);
    if (!factory) {
      throw new Error(`No adapter set registered for ${kind}`);
    }
    const set = factory(institutionId);
    this.cache.set(key, set);
    return set;
  }

  registeredKinds(): InstitutionKind[] {
    return [...this.byKind.keys()];
  }
}

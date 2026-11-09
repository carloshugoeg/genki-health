import type { DataEngine, InstitutionId, InstitutionKind } from '@genki/shared';
import { engineForKind } from '@genki/shared';
import type {
  CatalogoRepositoryPort,
  ClockPort,
  ConsultaRepositoryPort,
  IdPort,
  PacienteRepositoryPort,
  UnitOfWorkPort,
} from '../ports/index.js';
import type { Lane1FullModules } from '../ports/adapter-resource.js';

export type { Lane1FullModules };

export interface AdapterSet {
  readonly engine: DataEngine;
  readonly clock: ClockPort;
  readonly ids: IdPort;
  readonly unitOfWork: UnitOfWorkPort;
  readonly pacientes: PacienteRepositoryPort;
  readonly consultas: ConsultaRepositoryPort;
  readonly catalogos: CatalogoRepositoryPort;
  /** Lane-1 clinical shared modules (record / attachments / consultation). */
  readonly full?: Lane1FullModules;
}

export type AdapterSetFactory = (institutionId: InstitutionId) => AdapterSet;

/** Locked C3.2 kind → institution id assignment (CORE institutions 1–4). */
export const LOCKED_KIND_INSTITUTION_ID: Readonly<Record<InstitutionKind, number>> = {
  hospital_general: 1,
  centro_pediatrico: 2,
  laboratorio_clinico: 3,
  clinica_odontologica: 4,
};

function cacheKey(kind: InstitutionKind, institutionId: InstitutionId): string {
  return `${kind}:${institutionId}`;
}

function assertLockedAssignment(kind: InstitutionKind, institutionId: InstitutionId): void {
  if (LOCKED_KIND_INSTITUTION_ID[kind] !== institutionId) {
    throw new Error(`Unsupported institution assignment: ${kind}:${institutionId}`);
  }
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
    assertLockedAssignment(kind, institutionId);
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

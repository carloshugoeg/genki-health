import type { DataEngine, InstitutionId, InstitutionKind } from '@genki/shared';
import type { ClinicalContext } from './clinical-context.js';
import type { ClockPort } from './clock.js';

export type PersistenceCheckpoint = 'afterPaciente' | 'afterConsulta' | 'afterDiagnostico';

export interface EngineAdapterSet extends ClinicalContext {
  readonly engine: DataEngine;
}

export interface AdapterResource {
  set: EngineAdapterSet;
  close(): Promise<void>;
}

export interface EngineOptions {
  id_institucion: InstitutionId;
  kind: InstitutionKind;
  url: string;
  clock?: ClockPort;
  afterWrite?: (point: PersistenceCheckpoint) => void;
}

export interface FirestoreOptions {
  id_institucion: InstitutionId;
  kind: InstitutionKind;
  projectId: string;
  emulatorHost: string;
  clock?: ClockPort;
  afterWrite?: (point: PersistenceCheckpoint) => void;
}

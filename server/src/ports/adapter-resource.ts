import type { DataEngine, InstitutionId, InstitutionKind } from '@genki/shared';
import type { ClinicalContext } from './clinical-context.js';
import type { ClockPort } from './clock.js';
import type { AttachmentsRepositoryPort } from './full/attachments.js';
import type { ConsultationRepositoryPort } from './full/consultation.js';
import type { RecordRepositoryPort } from './full/record.js';

export type PersistenceCheckpoint = 'afterPaciente' | 'afterConsulta' | 'afterDiagnostico';

export interface Lane1FullModules {
  readonly record: RecordRepositoryPort;
  readonly attachments: AttachmentsRepositoryPort;
  readonly consultation: ConsultationRepositoryPort;
}

export interface EngineAdapterSet extends ClinicalContext {
  readonly engine: DataEngine;
  readonly full?: Lane1FullModules;
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

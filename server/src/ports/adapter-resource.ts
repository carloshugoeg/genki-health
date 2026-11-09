import type { DataEngine, InstitutionId, InstitutionKind } from '@genki/shared';
import type { ClinicalContext } from './clinical-context.js';
import type { ClockPort } from './clock.js';
import type { AdmissionRepositoryPort } from './full/admission.js';
import type { AgendaRepositoryPort } from './full/agenda.js';
import type { AttachmentsRepositoryPort } from './full/attachments.js';
import type { ChargesRepositoryPort } from './full/charges.js';
import type { ConsultationRepositoryPort } from './full/consultation.js';
import type { DentalChartRepositoryPort } from './full/dental-chart.js';
import type { DentalPlanRepositoryPort } from './full/dental-plan.js';
import type { DischargeRepositoryPort } from './full/discharge.js';
import type { GrowthRepositoryPort } from './full/growth.js';
import type { LabIntakeRepositoryPort } from './full/lab-intake.js';
import type { LabResultsRepositoryPort } from './full/lab-results.js';
import type { MilestonesRepositoryPort } from './full/milestones.js';
import type { ProcedureRepositoryPort } from './full/procedure.js';
import type { RecordRepositoryPort } from './full/record.js';
import type { VaccinesRepositoryPort } from './full/vaccines.js';

export type PersistenceCheckpoint = 'afterPaciente' | 'afterConsulta' | 'afterDiagnostico';

export interface Lane1FullModules {
  readonly record: RecordRepositoryPort;
  readonly attachments: AttachmentsRepositoryPort;
  readonly consultation: ConsultationRepositoryPort;
  readonly admission?: AdmissionRepositoryPort;
  readonly procedure?: ProcedureRepositoryPort;
  readonly discharge?: DischargeRepositoryPort;
  readonly growth?: GrowthRepositoryPort;
  readonly vaccines?: VaccinesRepositoryPort;
  readonly milestones?: MilestonesRepositoryPort;
  readonly labIntake?: LabIntakeRepositoryPort;
  readonly labResults?: LabResultsRepositoryPort;
  readonly dentalChart?: DentalChartRepositoryPort;
  readonly dentalPlan?: DentalPlanRepositoryPort;
  readonly agenda?: AgendaRepositoryPort;
  readonly charges?: ChargesRepositoryPort;
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

import type { InstitutionId } from '@genki/shared';
import type { ClinicalContext } from '../clinical-context.js';
import type { ClockPort } from '../clock.js';
import type { IdPort } from '../id.js';
import type { UnitOfWorkPort } from '../unit-of-work.js';
import type { AccountRepositoryPort } from './account.js';
import type { UsersRepositoryPort } from './users.js';
import type { PatientRepositoryPort } from './patient.js';
import type { RecordRepositoryPort } from './record.js';
import type { AttachmentsRepositoryPort } from './attachments.js';
import type { AgendaRepositoryPort } from './agenda.js';
import type { ConsultationRepositoryPort } from './consultation.js';
import type { AdmissionRepositoryPort } from './admission.js';
import type { ProcedureRepositoryPort } from './procedure.js';
import type { DischargeRepositoryPort } from './discharge.js';
import type { ReferralRepositoryPort } from './referral.js';
import type { GrowthRepositoryPort } from './growth.js';
import type { VaccinesRepositoryPort } from './vaccines.js';
import type { MilestonesRepositoryPort } from './milestones.js';
import type { LabIntakeRepositoryPort } from './lab-intake.js';
import type { LabResultsRepositoryPort } from './lab-results.js';
import type { DentalChartRepositoryPort } from './dental-chart.js';
import type { DentalPlanRepositoryPort } from './dental-plan.js';
import type { DentalSessionRepositoryPort } from './dental-session.js';
import type { PersonnelRepositoryPort } from './personnel.js';
import type { HonorariaRepositoryPort } from './honoraria.js';
import type { InventoryRepositoryPort } from './inventory.js';
import type { ChargesRepositoryPort } from './charges.js';
import type { InvoicingRepositoryPort } from './invoicing.js';
import type { PaymentsRepositoryPort } from './payments.js';
import type { HistoryRepositoryPort } from './history.js';

export const FULL_MODULE_SLUGS = [
  'account',
  'users',
  'patient',
  'record',
  'attachments',
  'agenda',
  'consultation',
  'admission',
  'procedure',
  'discharge',
  'referral',
  'growth',
  'vaccines',
  'milestones',
  'lab-intake',
  'lab-results',
  'dental-chart',
  'dental-plan',
  'dental-session',
  'personnel',
  'honoraria',
  'inventory',
  'charges',
  'invoicing',
  'payments',
  'history',
] as const;

export type FullModuleSlug = (typeof FULL_MODULE_SLUGS)[number];

export interface OperationContext {
  id_institucion: InstitutionId;
  id_usuario: number;
  id_profesional: number | null;
  roles: readonly string[];
  permissions: readonly string[];
  idempotency_key?: string;
  now: string;
}

export interface FullModulePorts {
  readonly account: AccountRepositoryPort;
  readonly users: UsersRepositoryPort;
  readonly patient: PatientRepositoryPort;
  readonly record: RecordRepositoryPort;
  readonly attachments: AttachmentsRepositoryPort;
  readonly agenda: AgendaRepositoryPort;
  readonly consultation: ConsultationRepositoryPort;
  readonly admission: AdmissionRepositoryPort;
  readonly procedure: ProcedureRepositoryPort;
  readonly discharge: DischargeRepositoryPort;
  readonly referral: ReferralRepositoryPort;
  readonly growth: GrowthRepositoryPort;
  readonly vaccines: VaccinesRepositoryPort;
  readonly milestones: MilestonesRepositoryPort;
  readonly labIntake: LabIntakeRepositoryPort;
  readonly labResults: LabResultsRepositoryPort;
  readonly dentalChart: DentalChartRepositoryPort;
  readonly dentalPlan: DentalPlanRepositoryPort;
  readonly dentalSession: DentalSessionRepositoryPort;
  readonly personnel: PersonnelRepositoryPort;
  readonly honoraria: HonorariaRepositoryPort;
  readonly inventory: InventoryRepositoryPort;
  readonly charges: ChargesRepositoryPort;
  readonly invoicing: InvoicingRepositoryPort;
  readonly payments: PaymentsRepositoryPort;
  readonly history: HistoryRepositoryPort;
}

export interface FullContext {
  base: ClinicalContext;
  modules: FullModulePorts;
  unitOfWork: UnitOfWorkPort;
  clock: ClockPort;
  ids: IdPort;
}

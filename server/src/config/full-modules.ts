import type { MemoryInstitutionState } from '../adapters/memory/state.js';
import { createMemoryAttachmentsRepository } from '../adapters/memory/full/attachments.js';
import { createMemoryAdmissionRepository } from '../adapters/memory/full/admission.js';
import { createMemoryConsultationRepository } from '../adapters/memory/full/consultation.js';
import { createMemoryDentalChartRepository } from '../adapters/memory/full/dental-chart.js';
import { createMemoryDentalPlanRepository } from '../adapters/memory/full/dental-plan.js';
import { createMemoryDischargeRepository } from '../adapters/memory/full/discharge.js';
import { createMemoryGrowthRepository } from '../adapters/memory/full/growth.js';
import { createMemoryLabIntakeRepository } from '../adapters/memory/full/lab-intake.js';
import { createMemoryLabResultsRepository } from '../adapters/memory/full/lab-results.js';
import { createMemoryMilestonesRepository } from '../adapters/memory/full/milestones.js';
import { createMemoryProcedureRepository } from '../adapters/memory/full/procedure.js';
import { createMemoryRecordRepository } from '../adapters/memory/full/record.js';
import { createMemoryVaccinesRepository } from '../adapters/memory/full/vaccines.js';
import { registerExtensionNamespace } from '../adapters/memory/full-state.js';
import type { FullModulePorts } from '../ports/full/context.js';
import { FULL_MODULE_SLUGS } from '../ports/full/context.js';
import type { AdapterSet, Lane1FullModules } from './adapter-registry.js';

export type { Lane1FullModules };

export interface AdapterSetWithFull extends AdapterSet {
  readonly full?: Lane1FullModules;
}

const SPECIALTY_MEMORY_SLUGS = [
  'record',
  'attachments',
  'consultation',
  'admission',
  'growth',
  'vaccines',
  'milestones',
  'lab-intake',
  'lab-results',
  'dental-chart',
  'dental-plan',
] as const;

export function ensureLane1MemoryExtensions(): void {
  for (const slug of SPECIALTY_MEMORY_SLUGS) {
    try {
      registerExtensionNamespace(slug);
    } catch {
      /* already registered in this process */
    }
  }
}

function stubModules(partial: Lane1FullModules): FullModulePorts {
  const missing = new Proxy(
    {},
    {
      get(_target, prop) {
        if (prop === 'then') return undefined;
        return () => {
          throw new Error(`full module not wired: ${String(prop)}`);
        };
      },
    },
  );
  const modules = {} as FullModulePorts;
  for (const slug of FULL_MODULE_SLUGS) {
    const key =
      slug === 'lab-intake'
        ? 'labIntake'
        : slug === 'lab-results'
          ? 'labResults'
          : slug === 'dental-chart'
            ? 'dentalChart'
            : slug === 'dental-plan'
              ? 'dentalPlan'
              : slug === 'dental-session'
                ? 'dentalSession'
                : slug;
    const bag = modules as unknown as Record<string, unknown>;
    const source = partial as unknown as Record<string, unknown>;
    bag[key] = source[key] ?? missing;
  }
  return modules;
}

export function attachMemoryFullModules(
  set: AdapterSet,
  state: MemoryInstitutionState,
): AdapterSetWithFull {
  ensureLane1MemoryExtensions();
  const afterWrite = (): void => undefined;
  const isStoreUnavailable = (): boolean => false;
  const common = {
    state,
    pacientes: set.pacientes,
    ids: set.ids,
    unitOfWork: set.unitOfWork,
    clock: set.clock,
    isStoreUnavailable,
    afterWrite,
  };
  const full: Lane1FullModules = {
    record: createMemoryRecordRepository(common),
    attachments: createMemoryAttachmentsRepository(common),
    consultation: createMemoryConsultationRepository(common),
    admission: createMemoryAdmissionRepository(common),
    procedure: createMemoryProcedureRepository({
      state,
      ids: set.ids,
      unitOfWork: set.unitOfWork,
      clock: set.clock,
    }),
    discharge: createMemoryDischargeRepository({
      state,
      unitOfWork: set.unitOfWork,
      clock: set.clock,
    }),
    growth: createMemoryGrowthRepository(common),
    vaccines: createMemoryVaccinesRepository(common),
    milestones: createMemoryMilestonesRepository({
      state,
      pacientes: set.pacientes,
      unitOfWork: set.unitOfWork,
      clock: set.clock,
    }),
    labIntake: createMemoryLabIntakeRepository({
      state,
      ids: set.ids,
      unitOfWork: set.unitOfWork,
      clock: set.clock,
    }),
    labResults: createMemoryLabResultsRepository({
      state,
      ids: set.ids,
      unitOfWork: set.unitOfWork,
      clock: set.clock,
    }),
    dentalChart: createMemoryDentalChartRepository(common),
    dentalPlan: createMemoryDentalPlanRepository(common),
  };
  return Object.assign(set, { full });
}

export function fullModulesFromSet(set: AdapterSetWithFull): FullModulePorts {
  if (!set.full) {
    throw new Error('lane-1 full modules missing on adapter set');
  }
  return stubModules(set.full);
}

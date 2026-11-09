import type { MemoryInstitutionState } from '../adapters/memory/state.js';
import { createMemoryAttachmentsRepository } from '../adapters/memory/full/attachments.js';
import { createMemoryConsultationRepository } from '../adapters/memory/full/consultation.js';
import { createMemoryRecordRepository } from '../adapters/memory/full/record.js';
import { registerExtensionNamespace } from '../adapters/memory/full-state.js';
import type { FullModulePorts } from '../ports/full/context.js';
import { FULL_MODULE_SLUGS } from '../ports/full/context.js';
import type { AdapterSet, Lane1FullModules } from './adapter-registry.js';

export type { Lane1FullModules };

export interface AdapterSetWithFull extends AdapterSet {
  readonly full?: Lane1FullModules;
}

export function ensureLane1MemoryExtensions(): void {
  for (const slug of ['record', 'attachments', 'consultation'] as const) {
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
    if (key === 'record') bag[key] = partial.record;
    else if (key === 'attachments') bag[key] = partial.attachments;
    else if (key === 'consultation') bag[key] = partial.consultation;
    else bag[key] = missing;
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
  const full: Lane1FullModules = {
    record: createMemoryRecordRepository({
      state,
      pacientes: set.pacientes,
      ids: set.ids,
      unitOfWork: set.unitOfWork,
      clock: set.clock,
      isStoreUnavailable,
      afterWrite,
    }),
    attachments: createMemoryAttachmentsRepository({
      state,
      pacientes: set.pacientes,
      ids: set.ids,
      unitOfWork: set.unitOfWork,
      clock: set.clock,
      isStoreUnavailable,
      afterWrite,
    }),
    consultation: createMemoryConsultationRepository({
      state,
      pacientes: set.pacientes,
      ids: set.ids,
      unitOfWork: set.unitOfWork,
      clock: set.clock,
      isStoreUnavailable,
      afterWrite,
    }),
  };
  return Object.assign(set, { full });
}

export function fullModulesFromSet(set: AdapterSetWithFull): FullModulePorts {
  if (!set.full) {
    throw new Error('lane-1 full modules missing on adapter set');
  }
  return stubModules(set.full);
}

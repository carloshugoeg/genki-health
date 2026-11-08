import type { InstitutionKind } from '@genki/shared';
import type { MemoryInstitutionState } from '../adapters/memory/state.js';
import type { AdapterSet } from './adapter-registry.js';
import { openMemoryAdapterSet, type MemoryAdapterOptions } from './memory-adapter-set.js';

export {
  registerExtensionNamespace,
  resetExtensionRegistryForTests,
} from '../adapters/memory/full-state.js';

export interface TestMemoryAdapterSet extends AdapterSet {
  readonly memoryState: MemoryInstitutionState;
}

/** Test-only memory composition. Not imported by production main/createPhase0Registry. */
export function createTestMemoryAdapterSet(
  kind: InstitutionKind,
  institutionId = 1,
  options?: MemoryAdapterOptions,
): TestMemoryAdapterSet {
  const opened = openMemoryAdapterSet(kind, institutionId, options);
  return Object.assign(opened.set, { memoryState: opened.state });
}

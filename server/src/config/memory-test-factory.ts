import type { InstitutionKind } from '@genki/shared';
import type { AdapterSet } from './adapter-registry.js';
import { buildMemoryAdapterSet } from './memory-adapter-set.js';

/** Test-only memory composition. Not imported by production main/createPhase0Registry. */
export function createTestMemoryAdapterSet(kind: InstitutionKind, institutionId = 1): AdapterSet {
  return buildMemoryAdapterSet(kind, institutionId);
}

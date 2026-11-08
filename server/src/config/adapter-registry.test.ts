import { describe, expect, it } from 'vitest';
import { asInstitutionId } from '@genki/shared';
import { createPhase0Registry } from './compose-memory.js';

describe('InstitutionAdapterRegistry', () => {
  it('registry_caches_one_set_per_kind_and_institution', () => {
    const registry = createPhase0Registry();
    const id = asInstitutionId(1);
    const first = registry.resolve('hospital_general', id);
    const second = registry.resolve('hospital_general', id);
    expect(second).toBe(first);

    const otherKind = registry.resolve('centro_pediatrico', id);
    expect(otherKind).not.toBe(first);

    const otherId = registry.resolve('hospital_general', asInstitutionId(2));
    expect(otherId).not.toBe(first);
  });
});

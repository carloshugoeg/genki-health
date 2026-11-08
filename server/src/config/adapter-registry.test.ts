import { describe, expect, it } from 'vitest';
import { asInstitutionId, type InstitutionKind } from '@genki/shared';
import { createPhase0Registry } from './compose-memory.js';
import { createTestMemoryAdapterSet } from './memory-test-factory.js';

const LOCKED_PAIRS: ReadonlyArray<{ kind: InstitutionKind; id: number }> = [
  { kind: 'hospital_general', id: 1 },
  { kind: 'centro_pediatrico', id: 2 },
  { kind: 'laboratorio_clinico', id: 3 },
  { kind: 'clinica_odontologica', id: 4 },
];

describe('InstitutionAdapterRegistry', () => {
  it('registry_caches_one_set_per_kind_and_institution', () => {
    const registry = createPhase0Registry();
    const hospitalId = asInstitutionId(1);
    const first = registry.resolve('hospital_general', hospitalId);
    const second = registry.resolve('hospital_general', hospitalId);
    expect(second).toBe(first);

    const pediatric = registry.resolve('centro_pediatrico', asInstitutionId(2));
    expect(pediatric).not.toBe(first);

    const lab = registry.resolve('laboratorio_clinico', asInstitutionId(3));
    expect(lab).not.toBe(first);
    expect(lab).not.toBe(pediatric);
  });

  it('registry_resolves_only_locked_kind_id_pairs', () => {
    const registry = createPhase0Registry();
    for (const { kind, id } of LOCKED_PAIRS) {
      const set = registry.resolve(kind, asInstitutionId(id));
      expect(set.engine).toBeTruthy();
    }
  });

  it('registry_rejects_non_locked_kind_id_pairs', () => {
    const registry = createPhase0Registry();
    const rejected: Array<{ kind: InstitutionKind; id: number }> = [
      { kind: 'hospital_general', id: 2 },
      { kind: 'centro_pediatrico', id: 1 },
      { kind: 'laboratorio_clinico', id: 1 },
      { kind: 'clinica_odontologica', id: 3 },
      { kind: 'hospital_general', id: 99 },
      { kind: 'centro_pediatrico', id: 99 },
    ];
    for (const { kind, id } of rejected) {
      expect(() => registry.resolve(kind, asInstitutionId(id))).toThrow();
    }
  });

  it('test_only_factory_handles_pairs_outside_production_allowlist', () => {
    const registry = createPhase0Registry();
    expect(() => registry.resolve('hospital_general', asInstitutionId(99))).toThrow();
    expect(() => registry.resolve('centro_pediatrico', asInstitutionId(1))).toThrow();

    const isolation = createTestMemoryAdapterSet('hospital_general', 99);
    expect(isolation.engine).toBe('postgres');

    const portablePediatric = createTestMemoryAdapterSet('centro_pediatrico', 1);
    expect(portablePediatric.engine).toBe('mysql');
  });
});

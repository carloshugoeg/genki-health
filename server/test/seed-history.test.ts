import { expect, it } from 'vitest';
import { FAKE_BANNER, SEED_TIME } from '../../scripts/seed.js';
import { seedHistoryPlan } from '../../scripts/seed-history.js';

const seedRow = {
  consulta: { motivo_consulta: FAKE_BANNER, fecha_hora_inicio: SEED_TIME },
};
const openRow = {
  consulta: { motivo_consulta: 'Dolor', fecha_hora_inicio: '2026-11-09T15:00:00.000Z' },
};

it('accepts a closed seed consult when extra consultations exist', () => {
  expect(seedHistoryPlan(101, [seedRow, openRow], FAKE_BANNER, SEED_TIME)).toBe('keep');
  expect(seedHistoryPlan(103, [openRow, seedRow], FAKE_BANNER, SEED_TIME)).toBe('keep');
});

it('creates the seed consult when none of the rows match the seed stamp', () => {
  expect(seedHistoryPlan(101, [], FAKE_BANNER, SEED_TIME)).toBe('create');
  expect(seedHistoryPlan(103, [openRow], FAKE_BANNER, SEED_TIME)).toBe('create');
});

it('requires patient 102 to have no history', () => {
  expect(seedHistoryPlan(102, [], FAKE_BANNER, SEED_TIME)).toBe('keep');
  expect(seedHistoryPlan(102, [openRow], FAKE_BANNER, SEED_TIME)).toBe('reject');
  expect(seedHistoryPlan(102, [seedRow], FAKE_BANNER, SEED_TIME)).toBe('reject');
});

import { asPacienteId } from '@genki/shared';
import { expect, it } from 'vitest';
import { formatEntityLabel, pacienteLabel } from './EntitySelect';

it('format_entity_label_is_name_and_id', () => {
  expect(formatEntityLabel('Ana María', 'López', 12)).toBe('Ana María López (#12)');
});

it('format_entity_label_collapses_blank_name_parts', () => {
  expect(formatEntityLabel('  Ana  ', '  López  ', 3)).toBe('Ana López (#3)');
});

it('paciente_label_joins_given_and_family_names', () => {
  expect(
    pacienteLabel({
      id_paciente: asPacienteId(101),
      primer_nombre: 'Ada',
      segundo_nombre: null,
      primer_apellido: 'Lovelace',
      segundo_apellido: 'King',
    }),
  ).toBe('Ada Lovelace King (#101)');
});

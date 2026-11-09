import { expect, it } from 'vitest';
import { canAccess } from './clinicalAccess';

it('administrador_does_not_reach_the_clinical_ficha_or_documents', () => {
  expect(canAccess(['administrador'], 'ficha')).toBe(false);
  expect(canAccess(['administrador'], 'documentos')).toBe(false);
  expect(canAccess(['administrador'], 'ingreso')).toBe(true);
  expect(canAccess(['administrador'], 'egreso')).toBe(false);
});

it('clinical_roles_reach_the_ficha', () => {
  for (const role of ['medico', 'odontologo', 'enfermeria']) {
    expect(canAccess([role], 'ficha')).toBe(true);
    expect(canAccess([role], 'documentos')).toBe(true);
  }
  expect(canAccess(['laboratorista'], 'ficha')).toBe(false);
  expect(canAccess(['laboratorista'], 'historialExamenes')).toBe(true);
});

it('superadministrador_sees_every_area', () => {
  expect(canAccess(['superadministrador'], 'ficha')).toBe(true);
  expect(canAccess(['superadministrador'], 'odontologia')).toBe(true);
});

it('only_odontologo_reaches_dental_features', () => {
  expect(canAccess(['medico'], 'odontologia')).toBe(false);
  expect(canAccess(['odontologo'], 'odontologia')).toBe(true);
});

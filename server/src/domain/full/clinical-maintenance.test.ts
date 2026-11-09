import { describe, expect, it } from 'vitest';
import { ClinicalError } from '../clinical-error.js';
import {
  assertAmendable,
  assertClosable,
  parseAnulacionBody,
  parseModificacionBody,
  planAnulacion,
  planModificacion,
  resolveActingProfesional,
} from './clinical-maintenance.js';
import { parseOp37Body } from './procedure.js';

function code(fn: () => unknown): string | undefined {
  try {
    fn();
  } catch (error) {
    return error instanceof ClinicalError ? error.code : 'other';
  }
  return undefined;
}

describe('clinical maintenance domain', () => {
  it('annuls through each entity status domain, once', () => {
    expect(
      planAnulacion({ entidad: 'diagnostico', values: { tipo: 'presuntivo', descripcion: 'x' } })
        .patch,
    ).toEqual({ entidad: 'diagnostico', tipo: 'descartado' });
    const tx = planAnulacion({
      entidad: 'tratamiento',
      values: {
        estado: 'activo',
        indicaciones: null,
        fecha_inicio: '2026-01-01',
        fecha_fin_estimada: null,
      },
    });
    expect(tx.patch).toEqual({ entidad: 'tratamiento', estado: 'suspendido' });
    expect(tx.antes).toEqual({ estado: 'activo' });
    expect(tx.despues).toEqual({ estado: 'suspendido' });
    expect(
      code(() =>
        planAnulacion({ entidad: 'receta', values: { estado: 'anulada', observaciones: null } }),
      ),
    ).toBe('conflict');
  });

  it('plans only real changes and rejects edits of annulled rows', () => {
    const plan = planModificacion(
      { entidad: 'diagnostico', values: { tipo: 'presuntivo', descripcion: 'Dolor' } },
      { entidad: 'diagnostico', tipo: 'definitivo', descripcion: 'Dolor' },
    );
    expect(plan.campos).toEqual(['tipo']);
    expect(
      code(() =>
        planModificacion(
          { entidad: 'diagnostico', values: { tipo: 'definitivo', descripcion: 'Dolor' } },
          { entidad: 'diagnostico', tipo: 'definitivo' },
        ),
      ),
    ).toBe('conflict');
    expect(
      code(() =>
        planModificacion(
          { entidad: 'diagnostico', values: { tipo: 'descartado', descripcion: 'Dolor' } },
          { entidad: 'diagnostico', tipo: 'definitivo' },
        ),
      ),
    ).toBe('conflict');
    expect(
      code(() =>
        planModificacion(
          {
            entidad: 'tratamiento',
            values: {
              estado: 'activo',
              indicaciones: null,
              fecha_inicio: '2026-05-10',
              fecha_fin_estimada: null,
            },
          },
          { entidad: 'tratamiento', fecha_fin_estimada: '2026-05-01' },
        ),
      ),
    ).toBe('invalid_bundle');
  });

  it('validates bodies: motivo required, no annul status via PATCH, no unknown keys', () => {
    expect(
      parseModificacionBody('tratamiento', { estado: 'finalizado', motivo: ' Alta ' }),
    ).toEqual({
      motivo: 'Alta',
      cambios: { entidad: 'tratamiento', estado: 'finalizado' },
    });
    expect(
      code(() => parseModificacionBody('diagnostico', { tipo: 'descartado', motivo: 'x' })),
    ).toBe('invalid_body');
    expect(code(() => parseModificacionBody('receta', { estado: 'anulada', motivo: 'x' }))).toBe(
      'invalid_body',
    );
    expect(code(() => parseModificacionBody('diagnostico', { tipo: 'definitivo' }))).toBe(
      'invalid_body',
    );
    expect(code(() => parseModificacionBody('tratamiento', { motivo: 'x' }))).toBe('invalid_body');
    expect(code(() => parseAnulacionBody({ motivo: '' }))).toBe('invalid_body');
    expect(code(() => parseAnulacionBody({ motivo: 'x', extra: 1 }))).toBe('invalid_body');
  });

  it('closes only open consultations on active records; amends only closed ones', () => {
    expect(
      code(() => assertClosable({ consulta_estado: 'cerrada', expediente_estado: 'activo' })),
    ).toBe('conflict');
    expect(
      code(() => assertClosable({ consulta_estado: 'abierta', expediente_estado: 'archivado' })),
    ).toBe('expediente_archived');
    expect(
      code(() => assertAmendable({ consulta_estado: 'abierta', expediente_estado: 'activo' })),
    ).toBe('conflict');
    expect(
      code(() => assertAmendable({ consulta_estado: 'cerrada', expediente_estado: 'activo' })),
    ).toBe(undefined);
  });

  it('attributes acts to the linked professional', () => {
    expect(resolveActingProfesional(7, undefined)).toBe(7);
    expect(resolveActingProfesional(7, 7)).toBe(7);
    expect(code(() => resolveActingProfesional(7, 1))).toBe('forbidden');
    expect(resolveActingProfesional(null, 3)).toBe(3);
    expect(code(() => resolveActingProfesional(null, undefined))).toBe('forbidden');
  });
});

describe('OP-37 procedure body', () => {
  it('accepts the audit body shape: equipo/consumos default, id_profesional optional, extras ignored', () => {
    const parsed = parseOp37Body({
      id_admision: 4,
      id_paciente: 101,
      codigo_procedimiento: 'PROC-CUR',
      descripcion: 'ignored, not a PROCEDIMIENTO attribute',
      fecha_hora: '2026-11-09T10:00:00Z',
    });
    expect(parsed).toEqual({
      id_admision: 4,
      codigo_procedimiento: 'PROC-CUR',
      fecha_hora: '2026-11-09T10:00:00.000Z',
      equipo: [],
      consumos: [],
    });
  });

  it('still rejects anchors, bad dates and oversized fields', () => {
    expect(
      code(() => parseOp37Body({ codigo_procedimiento: 'P', fecha_hora: '2026-11-09T10:00:00Z' })),
    ).toBe('invalid_body');
    expect(
      code(() =>
        parseOp37Body({ id_consulta: 1, codigo_procedimiento: 'P', fecha_hora: 'mañana' }),
      ),
    ).toBe('invalid_body');
    expect(
      code(() =>
        parseOp37Body({
          id_consulta: 1,
          codigo_procedimiento: 'P',
          fecha_hora: '2026-11-09T10:00:00Z',
          sala: 'x'.repeat(21),
        }),
      ),
    ).toBe('invalid_body');
  });
});

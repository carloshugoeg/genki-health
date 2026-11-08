import { describe, expect, it } from 'vitest';
import { ClinicalError } from './clinical-error.js';
import { validateConsulta, type ValidateConsultaInput } from './consulta.js';

const NOW = '2026-11-08T12:00:00.000Z';
const MAX_BUNDLE_UTF8_BYTES = 256 * 1024;

function validBundle(overrides: Partial<ValidateConsultaInput> = {}): ValidateConsultaInput {
  return {
    fecha_hora_inicio: '2026-11-08T11:00:00.000Z',
    diagnosticos: [
      {
        descripcion: 'Contenido académico simulado; no usar para atención',
        tipo: 'presuntivo',
        es_principal: true,
      },
    ],
    tratamientos: [
      {
        diagnostico_index: 0,
        tipo: 'reposo',
        descripcion: 'Contenido académico simulado; no usar para atención',
        fecha_inicio: '2026-11-08',
        estado: 'activo',
      },
    ],
    ...overrides,
  };
}

function utf8JsonSize(bundle: ValidateConsultaInput): number {
  return Buffer.byteLength(JSON.stringify(bundle), 'utf8');
}

function bundleWithUtf8JsonSize(targetBytes: number): ValidateConsultaInput {
  const probe = validBundle({
    diagnosticos: [
      {
        descripcion: '',
        tipo: 'presuntivo',
        es_principal: true,
      },
    ],
  });
  const baseSize = utf8JsonSize(probe);
  if (targetBytes < baseSize) {
    throw new Error(`targetBytes ${targetBytes} is below empty-description base ${baseSize}`);
  }
  probe.diagnosticos = [
    {
      descripcion: 'a'.repeat(targetBytes - baseSize),
      tipo: 'presuntivo',
      es_principal: true,
    },
  ];
  const size = utf8JsonSize(probe);
  if (size !== targetBytes) {
    throw new Error(`sized bundle got ${size} bytes, want ${targetBytes}`);
  }
  return probe;
}

function bundleWithMultibyteUtf8OverLimit(): ValidateConsultaInput {
  const asciiBase = bundleWithUtf8JsonSize(MAX_BUNDLE_UTF8_BYTES - 200);
  const descripcion = asciiBase.diagnosticos[0]!.descripcion;
  const replaceCount = 250;
  return {
    ...asciiBase,
    diagnosticos: [
      {
        ...asciiBase.diagnosticos[0]!,
        descripcion: `${descripcion.slice(0, -replaceCount)}${'é'.repeat(replaceCount)}`,
      },
    ],
  };
}

function expectInvalidBundle(run: () => void): void {
  expect(run).toThrow(ClinicalError);
  try {
    run();
  } catch (err) {
    expect(err).toBeInstanceOf(ClinicalError);
    expect((err as ClinicalError).code).toBe('invalid_bundle');
  }
}

describe('E2-P2-05 validateConsulta bundle invariants', () => {
  it('validate_consulta_requires_exactly_one_principal', () => {
    expect(() => validateConsulta(validBundle(), NOW)).not.toThrow();

    expectInvalidBundle(() =>
      validateConsulta(
        validBundle({
          diagnosticos: [
            {
              descripcion: 'Contenido académico simulado; no usar para atención',
              tipo: 'presuntivo',
              es_principal: false,
            },
          ],
        }),
        NOW,
      ),
    );

    expectInvalidBundle(() =>
      validateConsulta(
        validBundle({
          diagnosticos: [
            {
              descripcion: 'Contenido académico simulado; no usar para atención',
              tipo: 'presuntivo',
              es_principal: true,
            },
            {
              descripcion: 'Contenido académico simulado; no usar para atención',
              tipo: 'definitivo',
              es_principal: true,
            },
          ],
          tratamientos: [
            {
              diagnostico_index: 0,
              tipo: 'reposo',
              descripcion: 'Contenido académico simulado; no usar para atención',
              fecha_inicio: '2026-11-08',
              estado: 'activo',
            },
            {
              diagnostico_index: 1,
              tipo: 'dieta',
              descripcion: 'Contenido académico simulado; no usar para atención',
              fecha_inicio: '2026-11-08',
              estado: 'activo',
            },
          ],
        }),
        NOW,
      ),
    );

    expectInvalidBundle(() =>
      validateConsulta(
        validBundle({
          diagnosticos: [],
          tratamientos: [
            {
              diagnostico_index: 0,
              tipo: 'reposo',
              descripcion: 'Contenido académico simulado; no usar para atención',
              fecha_inicio: '2026-11-08',
              estado: 'activo',
            },
          ],
        }),
        NOW,
      ),
    );
  });

  it('validate_consulta_rejects_out_of_range_diagnostico_index', () => {
    expectInvalidBundle(() =>
      validateConsulta(
        validBundle({
          tratamientos: [
            {
              diagnostico_index: 1,
              tipo: 'reposo',
              descripcion: 'Contenido académico simulado; no usar para atención',
              fecha_inicio: '2026-11-08',
              estado: 'activo',
            },
          ],
        }),
        NOW,
      ),
    );

    expectInvalidBundle(() =>
      validateConsulta(
        validBundle({
          tratamientos: [
            {
              diagnostico_index: -1,
              tipo: 'reposo',
              descripcion: 'Contenido académico simulado; no usar para atención',
              fecha_inicio: '2026-11-08',
              estado: 'activo',
            },
          ],
        }),
        NOW,
      ),
    );
  });

  it('validate_consulta_requires_treatment_per_diagnosis', () => {
    expectInvalidBundle(() =>
      validateConsulta(
        validBundle({
          diagnosticos: [
            {
              descripcion: 'Contenido académico simulado; no usar para atención',
              tipo: 'presuntivo',
              es_principal: true,
            },
            {
              descripcion: 'Contenido académico simulado; no usar para atención',
              tipo: 'definitivo',
              es_principal: false,
            },
          ],
          tratamientos: [
            {
              diagnostico_index: 0,
              tipo: 'reposo',
              descripcion: 'Contenido académico simulado; no usar para atención',
              fecha_inicio: '2026-11-08',
              estado: 'activo',
            },
          ],
        }),
        NOW,
      ),
    );

    expect(() =>
      validateConsulta(
        validBundle({
          diagnosticos: [
            {
              descripcion: 'Contenido académico simulado; no usar para atención',
              tipo: 'presuntivo',
              es_principal: true,
            },
            {
              descripcion: 'Contenido académico simulado; no usar para atención',
              tipo: 'definitivo',
              es_principal: false,
            },
          ],
          tratamientos: [
            {
              diagnostico_index: 0,
              tipo: 'reposo',
              descripcion: 'Contenido académico simulado; no usar para atención',
              fecha_inicio: '2026-11-08',
              estado: 'activo',
            },
            {
              diagnostico_index: 1,
              tipo: 'dieta',
              descripcion: 'Contenido académico simulado; no usar para atención',
              fecha_inicio: '2026-11-08',
              estado: 'activo',
            },
          ],
        }),
        NOW,
      ),
    ).not.toThrow();
  });

  it('validate_consulta_rejects_duplicate_medication_ids', () => {
    expect(() =>
      validateConsulta(
        validBundle({
          receta: {
            detalles: [{ id_medicamento: 1 }, { id_medicamento: 2 }],
          },
        }),
        NOW,
      ),
    ).not.toThrow();

    expectInvalidBundle(() =>
      validateConsulta(
        validBundle({
          receta: {
            detalles: [{ id_medicamento: 1 }, { id_medicamento: 1 }],
          },
        }),
        NOW,
      ),
    );

    expectInvalidBundle(() =>
      validateConsulta(
        validBundle({
          receta: { detalles: [] },
        }),
        NOW,
      ),
    );
  });

  it('validate_consulta_rejects_future_fecha_hora_inicio', () => {
    expectInvalidBundle(() =>
      validateConsulta(
        validBundle({
          fecha_hora_inicio: '2026-11-08T12:00:00.001Z',
        }),
        NOW,
      ),
    );

    expect(() =>
      validateConsulta(
        validBundle({
          fecha_hora_inicio: NOW,
        }),
        NOW,
      ),
    ).not.toThrow();
  });

  it('validate_consulta_rejects_treatment_end_before_start', () => {
    expectInvalidBundle(() =>
      validateConsulta(
        validBundle({
          tratamientos: [
            {
              diagnostico_index: 0,
              tipo: 'reposo',
              descripcion: 'Contenido académico simulado; no usar para atención',
              fecha_inicio: '2026-11-08',
              fecha_fin_estimada: '2026-11-07',
              estado: 'activo',
            },
          ],
        }),
        NOW,
      ),
    );

    expect(() =>
      validateConsulta(
        validBundle({
          tratamientos: [
            {
              diagnostico_index: 0,
              tipo: 'reposo',
              descripcion: 'Contenido académico simulado; no usar para atención',
              fecha_inicio: '2026-11-08',
              fecha_fin_estimada: '2026-11-08',
              estado: 'activo',
            },
          ],
        }),
        NOW,
      ),
    ).not.toThrow();
  });

  it('validate_consulta_rejects_oversized_serialized_bundle', () => {
    const under = bundleWithUtf8JsonSize(MAX_BUNDLE_UTF8_BYTES - 1);
    expect(utf8JsonSize(under)).toBe(MAX_BUNDLE_UTF8_BYTES - 1);
    expect(() => validateConsulta(under, NOW)).not.toThrow();

    const exact = bundleWithUtf8JsonSize(MAX_BUNDLE_UTF8_BYTES);
    expect(utf8JsonSize(exact)).toBe(MAX_BUNDLE_UTF8_BYTES);
    expect(() => validateConsulta(exact, NOW)).not.toThrow();

    const overByOne = bundleWithUtf8JsonSize(MAX_BUNDLE_UTF8_BYTES + 1);
    expect(utf8JsonSize(overByOne)).toBe(MAX_BUNDLE_UTF8_BYTES + 1);
    expectInvalidBundle(() => validateConsulta(overByOne, NOW));

    const multibyteOver = bundleWithMultibyteUtf8OverLimit();
    const serialized = JSON.stringify(multibyteOver);
    expect(serialized.length).toBeLessThanOrEqual(MAX_BUNDLE_UTF8_BYTES);
    expect(Buffer.byteLength(serialized, 'utf8')).toBeGreaterThan(MAX_BUNDLE_UTF8_BYTES);
    expectInvalidBundle(() => validateConsulta(multibyteOver, NOW));
  });
});

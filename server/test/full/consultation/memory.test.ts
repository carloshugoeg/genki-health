import { describe, expect, it } from 'vitest';
import { createTestMemoryAdapterSet } from '../../../src/config/memory-test-factory.js';
import {
  registerExtensionNamespace,
  resetExtensionRegistryForTests,
} from '../../../src/adapters/memory/full-state.js';
import { createMemoryConsultationRepository } from '../../../src/adapters/memory/full/consultation.js';
import { executeOp26, executeOp27 } from '../../../src/application/full/consultation.js';
import type { FullContext, FullModulePorts } from '../../../src/ports/full/context.js';
import { FULL_MODULE_SLUGS } from '../../../src/ports/full/context.js';
import { expectedPrimaryCatalog, SEED_CIE10 } from '../../../src/testing/catalog-seeds.js';

describe('consultation memory OP26/27', () => {
  it('opens consultation and persists vital signs', async () => {
    resetExtensionRegistryForTests();
    registerExtensionNamespace('consultation');
    const adapters = createTestMemoryAdapterSet('hospital_general', 1);
    const catalogs = adapters.memoryState.getPublished().catalogs;
    const seed = expectedPrimaryCatalog();
    for (const row of seed.profesionales) {
      catalogs.profesionales.set(row.id_profesional, { ...row, activo: true });
    }
    catalogs.cie10.set(SEED_CIE10, { codigo_cie10: SEED_CIE10, descripcion: 'Examen general' });

    const created = await adapters.pacientes.createWithExpediente({
      tipo_documento: 'DPI',
      numero_documento: 'CONS-26-001',
      primer_nombre: 'Ana',
      primer_apellido: 'López',
      fecha_nacimiento: '1990-01-01',
      sexo: 'F',
    });

    const consultation = createMemoryConsultationRepository({
      state: adapters.memoryState,
      pacientes: adapters.pacientes,
      ids: adapters.ids,
      unitOfWork: adapters.unitOfWork,
      clock: adapters.clock,
      isStoreUnavailable: () => false,
      afterWrite: () => undefined,
    });

    const missing = new Proxy(
      {},
      {
        get(_t, prop) {
          if (prop === 'then') return undefined;
          return () => {
            throw new Error(`unwired ${String(prop)}`);
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
      (modules as Record<string, unknown>)[key] = slug === 'consultation' ? consultation : missing;
    }

    const context: FullContext = {
      base: adapters,
      modules,
      unitOfWork: adapters.unitOfWork,
      clock: adapters.clock,
      ids: adapters.ids,
    };
    const actor = {
      id_institucion: 1 as const,
      id_usuario: 10,
      id_profesional: 1,
      roles: ['medico'],
      permissions: [],
      now: '2026-11-09T12:00:00.000Z',
      idempotency_key: 'open-1',
    };

    const draft = await executeOp26(
      context,
      {
        params: { id: created.paciente.id_paciente },
        query: {},
        body: {
          id_profesional: seed.profesionales[0]!.id_profesional,
          tipo: 'primera_vez',
          motivo_consulta: 'Dolor de cabeza',
          fecha_hora_inicio: '2026-11-09T12:00:00.000Z',
        },
      },
      actor,
    );
    expect(draft.consulta.estado).toBe('abierta');
    expect(draft.revision).toBe(1);

    const signos = await executeOp27(
      context,
      {
        params: { id: draft.consulta.id_consulta },
        query: {},
        body: { temperatura_c: 36.8, frecuencia_cardiaca: 72 },
      },
      { ...actor, idempotency_key: 'vitals-1', roles: ['enfermeria'] },
    );
    expect(signos.id_consulta).toBe(draft.consulta.id_consulta);
    expect(signos.temperatura_c).toBe(36.8);
  });
});

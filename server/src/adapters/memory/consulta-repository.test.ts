import { describe, expect, it } from 'vitest';
import type { ExpedienteId, ProfesionalId } from '@genki/shared';
import { createTestMemoryAdapterSet } from '../../config/memory-test-factory.js';
import type { CloseConsultaBundle } from '../../ports/index.js';
import { SEED_CIE10, SEED_PROFESIONAL_ID } from '../../testing/catalog-seeds.js';

/** Collides with (receta=2, med=1) under receta*1_000_000+med. */
const MED_FOR_RECETA_1 = 1_000_001;
const MED_FOR_RECETA_2 = 1;

function seedCatalogs(adapters: ReturnType<typeof createTestMemoryAdapterSet>): void {
  const maps = adapters.memoryState.getPublished();
  maps.catalogs.cie10.set(SEED_CIE10, {
    codigo_cie10: SEED_CIE10,
    descripcion: 'Examen general',
  });
  maps.catalogs.profesionales.set(SEED_PROFESIONAL_ID, {
    id_profesional: SEED_PROFESIONAL_ID,
    nombres: 'Prof',
    apellidos: 'Uno',
    activo: true,
  });
  maps.catalogs.medicamentos.set(MED_FOR_RECETA_1, {
    id_medicamento: MED_FOR_RECETA_1,
    nombre_generico: 'Med collide high',
    activo: true,
  });
  maps.catalogs.medicamentos.set(MED_FOR_RECETA_2, {
    id_medicamento: MED_FOR_RECETA_2,
    nombre_generico: 'Med collide low',
    activo: true,
  });
}

function closeBundle(id_expediente: ExpedienteId, id_medicamento: number): CloseConsultaBundle {
  const now = '2026-11-07T15:30:00.000Z';
  return {
    consulta: {
      id_expediente,
      id_profesional: SEED_PROFESIONAL_ID as ProfesionalId,
      id_cita: null,
      fecha_hora_inicio: '2026-11-07T15:00:00.000Z',
      fecha_hora_fin: now,
      tipo: 'primera_vez',
      motivo_consulta: 'Control',
      enfermedad_actual: null,
      exploracion_fisica: null,
      plan: null,
      estado: 'cerrada',
    },
    diagnosticos: [
      {
        codigo_cie10: SEED_CIE10,
        descripcion: 'Examen general',
        tipo: 'presuntivo',
        es_principal: true,
        fecha_registro: now,
      },
    ],
    tratamientos: [],
    receta: {
      header: {
        id_profesional: SEED_PROFESIONAL_ID as ProfesionalId,
        folio: `REC-MED-${id_medicamento}`,
        fecha_emision: now,
        observaciones: null,
        estado: 'emitida',
      },
      detalles: [
        {
          id_medicamento,
          dosis: '500mg',
          via_administracion: 'oral',
          frecuencia_horas: 8,
          duracion_dias: 5,
          cantidad: 10,
          indicaciones: null,
        },
      ],
    },
  };
}

describe('MemoryConsultaRepository recipe lines', () => {
  it('keeps distinct recipe lines across colliding multiplier pairs and rolls back later failure', async () => {
    let failNextDiagnostico = false;
    const adapters = createTestMemoryAdapterSet('hospital_general', 1, {
      afterDiagnostico: () => {
        if (failNextDiagnostico) {
          throw new Error('forced afterDiagnostico rollback');
        }
      },
    });
    seedCatalogs(adapters);

    const { expediente } = await adapters.pacientes.createWithExpediente({
      tipo_documento: 'DPI',
      numero_documento: 'RECETA-KEY-1',
      primer_nombre: 'Ana',
      primer_apellido: 'Lopez',
      fecha_nacimiento: '1990-01-15',
      sexo: 'F',
    });

    const first = await adapters.consultas.closeConsulta(
      closeBundle(expediente.id_expediente, MED_FOR_RECETA_1),
    );
    const second = await adapters.consultas.closeConsulta(
      closeBundle(expediente.id_expediente, MED_FOR_RECETA_2),
    );

    expect(first.receta?.id_receta).toBe(1);
    expect(second.receta?.id_receta).toBe(2);
    expect(first.detalles).toHaveLength(1);
    expect(first.detalles[0]?.id_medicamento).toBe(MED_FOR_RECETA_1);
    expect(second.detalles).toHaveLength(1);
    expect(second.detalles[0]?.id_medicamento).toBe(MED_FOR_RECETA_2);

    const published = adapters.memoryState.getPublished();
    expect(published.recetas.size).toBe(2);
    expect(published.detalles.size).toBe(2);

    const history = await adapters.consultas.listByExpediente(expediente.id_expediente);
    expect(history).toHaveLength(2);
    expect(
      history.find((row) => row.receta?.id_receta === first.receta?.id_receta)?.detalles[0]
        ?.id_medicamento,
    ).toBe(MED_FOR_RECETA_1);
    expect(
      history.find((row) => row.receta?.id_receta === second.receta?.id_receta)?.detalles[0]
        ?.id_medicamento,
    ).toBe(MED_FOR_RECETA_2);

    const before = {
      consultas: published.consultas.size,
      diagnosticos: published.diagnosticos.size,
      recetas: published.recetas.size,
      detalles: published.detalles.size,
    };

    failNextDiagnostico = true;
    await expect(
      adapters.consultas.closeConsulta(closeBundle(expediente.id_expediente, MED_FOR_RECETA_2)),
    ).rejects.toThrow(/forced afterDiagnostico rollback/);

    const after = adapters.memoryState.getPublished();
    expect(after.consultas.size).toBe(before.consultas);
    expect(after.diagnosticos.size).toBe(before.diagnosticos);
    expect(after.recetas.size).toBe(before.recetas);
    expect(after.detalles.size).toBe(before.detalles);

    const historyAfter = await adapters.consultas.listByExpediente(expediente.id_expediente);
    expect(historyAfter).toHaveLength(2);
    expect(
      historyAfter.find((row) => row.receta?.id_receta === first.receta?.id_receta)?.detalles[0]
        ?.id_medicamento,
    ).toBe(MED_FOR_RECETA_1);
    expect(
      historyAfter.find((row) => row.receta?.id_receta === second.receta?.id_receta)?.detalles[0]
        ?.id_medicamento,
    ).toBe(MED_FOR_RECETA_2);
  });
});

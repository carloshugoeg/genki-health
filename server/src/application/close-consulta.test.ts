import { describe, expect, it } from 'vitest';
import type { CloseConsultaRequest, RegisterPacienteRequest } from '@genki/shared';
import { createTestMemoryAdapterSet } from '../config/memory-test-factory.js';
import { SEED_CIE10, SEED_MEDICAMENTO_1, SEED_PROFESIONAL_ID } from '../testing/catalog-seeds.js';
import { closeConsulta } from './close-consulta.js';
import { ClinicalError } from '../domain/clinical-error.js';

function adult(numero_documento: string): RegisterPacienteRequest {
  return {
    tipo_documento: 'DPI',
    numero_documento,
    primer_nombre: 'Ana',
    primer_apellido: 'Lopez',
    fecha_nacimiento: '1990-01-15',
    sexo: 'F',
  };
}

function closeBody(withReceta: boolean): CloseConsultaRequest {
  const body: CloseConsultaRequest = {
    id_profesional: SEED_PROFESIONAL_ID,
    fecha_hora_inicio: '2026-11-07T15:00:00.000Z',
    tipo: 'primera_vez',
    motivo_consulta: 'Control',
    enfermedad_actual: null,
    exploracion_fisica: null,
    plan: null,
    diagnosticos: [
      {
        codigo_cie10: SEED_CIE10,
        descripcion: 'Examen general',
        tipo: 'presuntivo',
        es_principal: true,
      },
      {
        codigo_cie10: null,
        descripcion: 'Seguimiento',
        tipo: 'definitivo',
        es_principal: false,
      },
    ],
    tratamientos: [
      {
        diagnostico_index: 0,
        tipo: 'farmacologico',
        descripcion: 'Analgesico',
        indicaciones: null,
        fecha_inicio: '2026-11-07',
        fecha_fin_estimada: null,
        estado: 'activo',
      },
      {
        diagnostico_index: 1,
        tipo: 'reposo',
        descripcion: 'Reposo relativo',
        indicaciones: null,
        fecha_inicio: '2026-11-07',
        fecha_fin_estimada: null,
        estado: 'activo',
      },
    ],
  };
  if (withReceta) {
    body.receta = {
      observaciones: null,
      detalles: [
        {
          id_medicamento: SEED_MEDICAMENTO_1,
          dosis: '500mg',
          via_administracion: 'oral',
          frecuencia_horas: 8,
          duracion_dias: 5,
          cantidad: 15,
          indicaciones: null,
        },
      ],
    };
  }
  return body;
}

describe('closeConsulta', () => {
  it('close_persists_complete_bundle', async () => {
    const adapters = createTestMemoryAdapterSet('hospital_general', 1);
    adapters.memoryState.getPublished().catalogs.cie10.set(SEED_CIE10, {
      codigo_cie10: SEED_CIE10,
      descripcion: 'Examen general',
    });
    adapters.memoryState.getPublished().catalogs.profesionales.set(SEED_PROFESIONAL_ID, {
      id_profesional: SEED_PROFESIONAL_ID,
      nombres: 'Prof',
      apellidos: 'Uno',
      activo: true,
    });
    adapters.memoryState.getPublished().catalogs.medicamentos.set(SEED_MEDICAMENTO_1, {
      id_medicamento: SEED_MEDICAMENTO_1,
      nombre_generico: 'Med A',
      activo: true,
    });

    const { paciente } = await adapters.pacientes.createWithExpediente(adult('CLOSE-APP-1'));
    const completa = await closeConsulta(adapters, {
      id_paciente: paciente.id_paciente,
      body: closeBody(true),
    });
    expect(completa.consulta.estado).toBe('cerrada');
    expect(completa.consulta.id_cita).toBeNull();
    expect(completa.diagnosticos).toHaveLength(2);
    expect(completa.tratamientos).toHaveLength(2);
    expect(completa.receta).not.toBeNull();
    expect(completa.detalles).toHaveLength(1);
    expect(completa.receta?.folio).toMatch(/^REC-/);
  });

  it('close_without_recipe_is_atomic', async () => {
    const adapters = createTestMemoryAdapterSet('hospital_general', 1);
    adapters.memoryState.getPublished().catalogs.cie10.set(SEED_CIE10, {
      codigo_cie10: SEED_CIE10,
      descripcion: 'Examen general',
    });
    adapters.memoryState.getPublished().catalogs.profesionales.set(SEED_PROFESIONAL_ID, {
      id_profesional: SEED_PROFESIONAL_ID,
      nombres: 'Prof',
      apellidos: 'Uno',
      activo: true,
    });
    const { paciente } = await adapters.pacientes.createWithExpediente(adult('CLOSE-APP-2'));
    const completa = await closeConsulta(adapters, {
      id_paciente: paciente.id_paciente,
      body: closeBody(false),
    });
    expect(completa.receta).toBeNull();
    expect(completa.detalles).toEqual([]);
  });

  it('close_failure_after_diagnosis_rolls_back_every_child', async () => {
    const adapters = createTestMemoryAdapterSet('hospital_general', 1, {
      afterDiagnostico: () => {
        throw new Error('checkpoint afterDiagnostico');
      },
    });
    adapters.memoryState.getPublished().catalogs.cie10.set(SEED_CIE10, {
      codigo_cie10: SEED_CIE10,
      descripcion: 'Examen general',
    });
    adapters.memoryState.getPublished().catalogs.profesionales.set(SEED_PROFESIONAL_ID, {
      id_profesional: SEED_PROFESIONAL_ID,
      nombres: 'Prof',
      apellidos: 'Uno',
      activo: true,
    });
    const { paciente, expediente } = await adapters.pacientes.createWithExpediente(
      adult('CLOSE-APP-3'),
    );
    await expect(
      closeConsulta(adapters, {
        id_paciente: paciente.id_paciente,
        body: closeBody(false),
      }),
    ).rejects.toBeTruthy();
    expect(adapters.memoryState.getPublished().consultas.size).toBe(0);
    expect(adapters.memoryState.getPublished().diagnosticos.size).toBe(0);
    expect(await adapters.consultas?.listByExpediente(expediente.id_expediente)).toEqual([]);
  });

  it('archive_close_race_serializes', async () => {
    const adapters = createTestMemoryAdapterSet('hospital_general', 1);
    adapters.memoryState.getPublished().catalogs.cie10.set(SEED_CIE10, {
      codigo_cie10: SEED_CIE10,
      descripcion: 'Examen general',
    });
    adapters.memoryState.getPublished().catalogs.profesionales.set(SEED_PROFESIONAL_ID, {
      id_profesional: SEED_PROFESIONAL_ID,
      nombres: 'Prof',
      apellidos: 'Uno',
      activo: true,
    });
    const { paciente, expediente } = await adapters.pacientes.createWithExpediente(
      adult('CLOSE-APP-4'),
    );
    const results = await Promise.allSettled([
      closeConsulta(adapters, {
        id_paciente: paciente.id_paciente,
        body: closeBody(false),
      }),
      adapters.pacientes.archiveExpediente({
        id_expediente: expediente.id_expediente,
        motivo_archivo: 'administrativo',
        fecha_archivo: adapters.clock.nowIso(),
      }),
    ]);
    expect(results[1]?.status).toBe('fulfilled');
    const archived = await adapters.pacientes.findExpedienteById(expediente.id_expediente);
    expect(archived?.estado).toBe('archivado');
    const closeResult = results[0];
    if (closeResult?.status === 'rejected') {
      expect((closeResult.reason as ClinicalError).code).toBe('expediente_archived');
    }
  });

  it('close_on_active_record', async () => {
    const adapters = createTestMemoryAdapterSet('hospital_general', 1);
    adapters.memoryState.getPublished().catalogs.cie10.set(SEED_CIE10, {
      codigo_cie10: SEED_CIE10,
      descripcion: 'Examen general',
    });
    adapters.memoryState.getPublished().catalogs.profesionales.set(SEED_PROFESIONAL_ID, {
      id_profesional: SEED_PROFESIONAL_ID,
      nombres: 'Prof',
      apellidos: 'Uno',
      activo: true,
    });
    const { paciente, expediente } = await adapters.pacientes.createWithExpediente(
      adult('CLOSE-ACT-1'),
    );
    expect(expediente.estado).toBe('activo');
    const completa = await closeConsulta(adapters, {
      id_paciente: paciente.id_paciente,
      body: closeBody(false),
    });
    expect(completa.consulta.estado).toBe('cerrada');
    expect(completa.consulta.id_expediente).toBe(expediente.id_expediente);
    expect(completa.diagnosticos.length).toBeGreaterThanOrEqual(1);
    expect(completa.tratamientos.length).toBeGreaterThanOrEqual(1);
  });

  it('close_failure_preserves_record', async () => {
    const adapters = createTestMemoryAdapterSet('hospital_general', 1, {
      afterDiagnostico: () => {
        throw new Error('forced mid-write failure');
      },
    });
    adapters.memoryState.getPublished().catalogs.cie10.set(SEED_CIE10, {
      codigo_cie10: SEED_CIE10,
      descripcion: 'Examen general',
    });
    adapters.memoryState.getPublished().catalogs.profesionales.set(SEED_PROFESIONAL_ID, {
      id_profesional: SEED_PROFESIONAL_ID,
      nombres: 'Prof',
      apellidos: 'Uno',
      activo: true,
    });
    const { paciente, expediente } = await adapters.pacientes.createWithExpediente(
      adult('CLOSE-FAIL-1'),
    );
    await expect(
      closeConsulta(adapters, {
        id_paciente: paciente.id_paciente,
        body: closeBody(false),
      }),
    ).rejects.toBeTruthy();
    expect(adapters.memoryState.getPublished().consultas.size).toBe(0);
    expect(adapters.memoryState.getPublished().diagnosticos.size).toBe(0);
    expect(adapters.memoryState.getPublished().tratamientos.size).toBe(0);
    const still = await adapters.pacientes.findExpedienteById(expediente.id_expediente);
    expect(still?.estado).toBe('activo');
  });

  it('close_on_archived_record_rejected', async () => {
    const adapters = createTestMemoryAdapterSet('hospital_general', 1);
    adapters.memoryState.getPublished().catalogs.cie10.set(SEED_CIE10, {
      codigo_cie10: SEED_CIE10,
      descripcion: 'Examen general',
    });
    adapters.memoryState.getPublished().catalogs.profesionales.set(SEED_PROFESIONAL_ID, {
      id_profesional: SEED_PROFESIONAL_ID,
      nombres: 'Prof',
      apellidos: 'Uno',
      activo: true,
    });
    const { paciente, expediente } = await adapters.pacientes.createWithExpediente(
      adult('CLOSE-ARCH-1'),
    );
    await adapters.pacientes.archiveExpediente({
      id_expediente: expediente.id_expediente,
      motivo_archivo: 'administrativo',
      fecha_archivo: adapters.clock.nowIso(),
    });
    await expect(
      closeConsulta(adapters, {
        id_paciente: paciente.id_paciente,
        body: closeBody(false),
      }),
    ).rejects.toMatchObject({ code: 'expediente_archived' });
    expect(adapters.memoryState.getPublished().consultas.size).toBe(0);
  });
});

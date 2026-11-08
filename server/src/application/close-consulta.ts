import type {
  CloseConsultaRequest,
  ConsultaCompleta,
  PacienteId,
  ProfesionalId,
} from '@genki/shared';
import { ClinicalError } from '../domain/clinical-error.js';
import { validateConsulta } from '../domain/consulta.js';
import type { ClinicalContext } from '../ports/clinical-context.js';
import type { CloseConsultaBundle } from '../ports/consulta-repository.js';

export async function closeConsulta(
  adapters: ClinicalContext,
  input: { id_paciente: PacienteId; body: CloseConsultaRequest },
): Promise<ConsultaCompleta> {
  return adapters.unitOfWork.runInTransaction(async () => {
    const expediente = await adapters.pacientes.findExpedienteByPaciente(input.id_paciente);
    if (!expediente) {
      throw new ClinicalError('not_found', 'Expediente no encontrado');
    }
    if (expediente.estado === 'archivado') {
      throw new ClinicalError('expediente_archived', 'El expediente está archivado');
    }

    const nowIso = adapters.clock.nowIso();
    validateConsulta(input.body, nowIso);

    const catalogs = await adapters.catalogos.list();
    const professionalOk = catalogs.profesionales.some(
      (row) => row.id_profesional === input.body.id_profesional,
    );
    if (!professionalOk) {
      throw new ClinicalError('reference_not_found', 'Profesional no encontrado');
    }

    if (input.body.receta) {
      const medIds = new Set(catalogs.medicamentos.map((m) => m.id_medicamento));
      for (const detalle of input.body.receta.detalles) {
        if (!medIds.has(detalle.id_medicamento)) {
          throw new ClinicalError('reference_not_found', 'Medicamento no encontrado');
        }
      }
    }

    const body = input.body;
    const id_profesional = body.id_profesional as ProfesionalId;
    const bundle: CloseConsultaBundle = {
      consulta: {
        id_expediente: expediente.id_expediente,
        id_profesional,
        id_cita: null,
        fecha_hora_inicio: body.fecha_hora_inicio,
        fecha_hora_fin: nowIso,
        tipo: body.tipo,
        motivo_consulta: body.motivo_consulta,
        enfermedad_actual: body.enfermedad_actual ?? null,
        exploracion_fisica: body.exploracion_fisica ?? null,
        plan: body.plan ?? null,
        estado: 'cerrada',
      },
      diagnosticos: body.diagnosticos.map((dx) => ({
        codigo_cie10: dx.codigo_cie10 ?? null,
        descripcion: dx.descripcion,
        tipo: dx.tipo,
        es_principal: dx.es_principal,
        fecha_registro: nowIso,
      })),
      tratamientos: body.tratamientos.map((tx) => ({
        diagnostico_index: tx.diagnostico_index,
        tipo: tx.tipo,
        descripcion: tx.descripcion,
        indicaciones: tx.indicaciones ?? null,
        fecha_inicio: tx.fecha_inicio,
        fecha_fin_estimada: tx.fecha_fin_estimada ?? null,
        estado: tx.estado,
      })),
      ...(body.receta
        ? {
            receta: {
              header: {
                id_profesional,
                folio: `REC-${await adapters.ids.nextInt('receta_folio')}`,
                fecha_emision: nowIso,
                observaciones: body.receta.observaciones ?? null,
                estado: 'emitida',
              },
              detalles: body.receta.detalles.map((d) => ({
                id_medicamento: d.id_medicamento,
                dosis: d.dosis,
                via_administracion: d.via_administracion,
                frecuencia_horas: d.frecuencia_horas,
                duracion_dias: d.duracion_dias,
                cantidad: d.cantidad,
                indicaciones: d.indicaciones ?? null,
              })),
            },
          }
        : {}),
    };

    return adapters.consultas.closeConsulta(bundle);
  });
}

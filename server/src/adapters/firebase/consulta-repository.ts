import {
  asConsultaId,
  type ConsultaCompleta,
  type ConsultaDto,
  type ConsultaId,
  type DiagnosticoId,
  type ExpedienteId,
  type RecetaId,
  type TratamientoId,
} from '@genki/shared';
import { ClinicalError } from '../../domain/clinical-error.js';
import { validateConsulta, type ValidateTratamientoInput } from '../../domain/consulta.js';
import type { CloseConsultaBundle, ConsultaRepositoryPort, IdPort } from '../../ports/index.js';
import { toFirestore } from './mapper.js';
import type { FirebaseUnitOfWork } from './unit-of-work.js';

/** C5.2 stores the consultation DTO at top level with bounded child arrays. */
function complete(row: Record<string, unknown>): ConsultaCompleta {
  const stored = row as unknown as ConsultaDto & Omit<ConsultaCompleta, 'consulta'>;
  const { diagnosticos, tratamientos, receta, detalles } = stored;
  const consulta: ConsultaDto = {
    id_consulta: stored.id_consulta,
    id_expediente: stored.id_expediente,
    id_profesional: stored.id_profesional,
    id_cita: stored.id_cita ?? null,
    fecha_hora_inicio: stored.fecha_hora_inicio,
    fecha_hora_fin: stored.fecha_hora_fin ?? null,
    tipo: stored.tipo,
    motivo_consulta: stored.motivo_consulta,
    enfermedad_actual: stored.enfermedad_actual ?? null,
    exploracion_fisica: stored.exploracion_fisica ?? null,
    plan: stored.plan ?? null,
    estado: stored.estado,
  };
  return structuredClone({
    consulta,
    diagnosticos,
    tratamientos,
    receta: receta ?? null,
    detalles: detalles ?? [],
  }) as ConsultaCompleta;
}
function invalid(message: string): never {
  throw new ClinicalError('invalid_bundle', message);
}
function missing(): never {
  throw new ClinicalError('reference_not_found', 'Referencia de catálogo no encontrada');
}

export class FirebaseConsultaRepository implements ConsultaRepositoryPort {
  constructor(
    private readonly unitOfWork: FirebaseUnitOfWork,
    private readonly ids: IdPort,
    private readonly nowIso: () => string,
  ) {}

  async closeConsulta(bundle: CloseConsultaBundle): Promise<ConsultaCompleta> {
    return this.unitOfWork.runInTransaction(async () => {
      validateConsulta(
        {
          fecha_hora_inicio: bundle.consulta.fecha_hora_inicio,
          diagnosticos: bundle.diagnosticos.map((dx) => ({
            ...dx,
            tipo: dx.tipo as 'presuntivo' | 'definitivo',
          })),
          tratamientos: bundle.tratamientos.map((tx) => ({
            ...tx,
            tipo: tx.tipo as ValidateTratamientoInput['tipo'],
            estado: tx.estado as 'activo',
          })),
          receta: bundle.receta ? { detalles: [...bundle.receta.detalles] } : null,
        },
        this.nowIso(),
      );
      if (bundle.consulta.estado !== 'cerrada' || bundle.consulta.fecha_hora_fin == null)
        invalid('La consulta debe estar cerrada');
      if (bundle.receta && bundle.receta.header.id_profesional !== bundle.consulta.id_profesional)
        invalid('Profesional de receta inválido');
      const record = await this.unitOfWork.read('records', bundle.consulta.id_expediente);
      if (!record) throw new ClinicalError('not_found', 'Recurso no encontrado');
      if (record.estado === 'archivado')
        throw new ClinicalError('expediente_archived', 'El expediente está archivado');
      if (!(await this.unitOfWork.read('patients', record.id_paciente)))
        throw new ClinicalError('not_found', 'Recurso no encontrado');
      const professional = await this.unitOfWork.read(
        'professionals',
        bundle.consulta.id_profesional,
      );
      if (professional?.activo !== true) missing();
      for (const dx of bundle.diagnosticos) {
        if (dx.codigo_cie10 && !(await this.unitOfWork.read('cie10', dx.codigo_cie10))) missing();
      }
      for (const detail of bundle.receta?.detalles ?? []) {
        if ((await this.unitOfWork.read('medications', detail.id_medicamento))?.activo !== true)
          missing();
      }
      const id_consulta = asConsultaId(await this.ids.nextInt('consulta'));
      const consulta: ConsultaDto = { ...bundle.consulta, id_consulta };
      const diagnosticos: ConsultaCompleta['diagnosticos'] = [];
      for (const dx of bundle.diagnosticos) {
        diagnosticos.push({
          ...dx,
          id_diagnostico: (await this.ids.nextInt('diagnostico')) as DiagnosticoId,
          id_consulta,
        });
      }
      const tratamientos: ConsultaCompleta['tratamientos'] = [];
      for (const tx of bundle.tratamientos) {
        const { diagnostico_index, ...data } = tx;
        const diagnosis = diagnosticos[diagnostico_index];
        if (!diagnosis) invalid('Índice de diagnóstico inválido');
        tratamientos.push({
          ...data,
          id_tratamiento: (await this.ids.nextInt('tratamiento')) as TratamientoId,
          id_diagnostico: diagnosis.id_diagnostico,
        });
      }
      const receta = bundle.receta
        ? {
            ...bundle.receta.header,
            id_consulta,
            id_receta: (await this.ids.nextInt('receta')) as RecetaId,
          }
        : null;
      const detalles = receta
        ? bundle
            .receta!.detalles.map((detail) => ({ ...detail, id_receta: receta.id_receta }))
            .sort((a, b) => a.id_medicamento - b.id_medicamento)
        : [];
      const document = toFirestore({
        ...consulta,
        diagnosticos,
        tratamientos,
        receta,
        detalles,
      }) as Record<string, unknown>;
      if (Buffer.byteLength(JSON.stringify(document), 'utf8') > 256 * 1024)
        invalid('Consultation bundle exceeds 256 KiB UTF-8 JSON');
      await this.unitOfWork.update('records', bundle.consulta.id_expediente, {
        revision: record.revision + 1,
      });
      // Generated ID was read under its counter lock. One complete document, never a diagnosis collection.
      this.unitOfWork.set('consultations', id_consulta, document, 'afterConsulta');
      this.unitOfWork.set('consultations', id_consulta, document, 'afterDiagnostico');
      return complete(document);
    });
  }

  async findById(id: ConsultaId): Promise<ConsultaDto | null> {
    const row = await this.unitOfWork.read('consultations', id);
    return row ? complete(row).consulta : null;
  }

  async listByExpediente(id: ExpedienteId): Promise<ConsultaCompleta[]> {
    const rows = await this.unitOfWork.query('consultations', () => true, id);
    return rows
      .map(complete)
      .sort((a, b) =>
        a.consulta.fecha_hora_inicio === b.consulta.fecha_hora_inicio
          ? b.consulta.id_consulta - a.consulta.id_consulta
          : a.consulta.fecha_hora_inicio < b.consulta.fecha_hora_inicio
            ? 1
            : -1,
      );
  }
}

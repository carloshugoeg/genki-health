/**
 * Clínica odontológica Firestore: OP-31 close of an open consultation and audited corrections of
 * diagnosis / treatment / prescription. The consultation document embeds its children (C5.2), so
 * every write rewrites that one document. All reads and staged writes go through the caller's
 * FirebaseUnitOfWork transaction (writes are buffered until commit, so find* -> write -> bitácora
 * is safe in one runInTransaction). Reading the `records` doc and bumping its `revision`
 * serializes these writes with OP-18 archive, exactly like FirebaseConsultaRepository.closeConsulta.
 * Data is institution-local by path (`institutions/{id}/...`), so scoping is structural.
 */
import type {
  ConsultaCompleta,
  ConsultaDto,
  DetalleRecetaDto,
  DiagnosticoDto,
  DiagnosticoId,
  ExpedienteEstado,
  InstitutionId,
  RecetaDto,
  RecetaId,
  TratamientoDto,
  TratamientoId,
} from '@genki/shared';
import type { ClinicalItemDto } from '@genki/shared/full/consultation';
import { ClinicalError } from '../../../domain/clinical-error.js';
import type { ClinicalItemEntity } from '../../../domain/full/clinical-maintenance.js';
import type { IdPort } from '../../../ports/id.js';
import type {
  BitacoraClinicaEntry,
  CierreConsultaBundle,
  ClinicalItemPatch,
  ClinicalItemSnapshot,
  ConsultaParaCierre,
  ConsultationRepositoryPort,
} from '../../../ports/full/consultation.js';
import { toFirestore } from '../mapper.js';
import type { FirebaseUnitOfWork } from '../unit-of-work.js';

const NOT_FOUND = 'Recurso no encontrado';
const CONFLICT = 'Conflicto de recurso';
const REFERENCE_NOT_FOUND = 'Referencia de catálogo no encontrada';
const MAX_DOC_BYTES = 256 * 1024;

type Row = Record<string, unknown>;

export type ClinicalMaintenanceMethods = Pick<
  ConsultationRepositoryPort,
  | 'findConsultaParaCierre'
  | 'guardarCierreConsulta'
  | 'findClinicalItem'
  | 'updateClinicalItem'
  | 'appendBitacora'
>;

function consultaDto(row: Row): ConsultaDto {
  const s = row as unknown as ConsultaDto;
  return {
    id_consulta: s.id_consulta,
    id_expediente: s.id_expediente,
    id_profesional: s.id_profesional,
    id_cita: s.id_cita ?? null,
    fecha_hora_inicio: s.fecha_hora_inicio,
    fecha_hora_fin: s.fecha_hora_fin ?? null,
    tipo: s.tipo,
    motivo_consulta: s.motivo_consulta,
    enfermedad_actual: s.enfermedad_actual ?? null,
    exploracion_fisica: s.exploracion_fisica ?? null,
    plan: s.plan ?? null,
    estado: s.estado,
  };
}

function diagnosticos(row: Row): DiagnosticoDto[] {
  return ((row.diagnosticos as DiagnosticoDto[] | null) ?? []).map((d) => ({
    id_diagnostico: d.id_diagnostico,
    id_consulta: d.id_consulta,
    codigo_cie10: d.codigo_cie10 ?? null,
    descripcion: d.descripcion,
    tipo: d.tipo,
    es_principal: d.es_principal,
    fecha_registro: d.fecha_registro,
  }));
}

function tratamientos(row: Row): TratamientoDto[] {
  return ((row.tratamientos as TratamientoDto[] | null) ?? []).map((t) => ({
    id_tratamiento: t.id_tratamiento,
    id_diagnostico: t.id_diagnostico,
    tipo: t.tipo,
    descripcion: t.descripcion,
    indicaciones: t.indicaciones ?? null,
    fecha_inicio: t.fecha_inicio,
    fecha_fin_estimada: t.fecha_fin_estimada ?? null,
    estado: t.estado,
  }));
}

function receta(row: Row): RecetaDto | null {
  const r = row.receta as RecetaDto | null | undefined;
  if (!r) return null;
  return {
    id_receta: r.id_receta,
    id_consulta: r.id_consulta,
    id_profesional: r.id_profesional,
    folio: r.folio,
    fecha_emision: r.fecha_emision,
    observaciones: r.observaciones ?? null,
    estado: r.estado,
  };
}

function complete(row: Row): ConsultaCompleta {
  return structuredClone({
    consulta: consultaDto(row),
    diagnosticos: diagnosticos(row),
    tratamientos: tratamientos(row),
    receta: receta(row),
    detalles: ((row.detalles as DetalleRecetaDto[] | null) ?? []).map((d) => ({ ...d })),
  }) as ConsultaCompleta;
}

/** Does this consultation document embed the clinical item `id` of `entidad`? */
function embeds(row: Row, entidad: ClinicalItemEntity, id: number): boolean {
  if (entidad === 'diagnostico')
    return ((row.diagnosticos as Row[] | null) ?? []).some((d) => d.id_diagnostico === id);
  if (entidad === 'tratamiento')
    return ((row.tratamientos as Row[] | null) ?? []).some((t) => t.id_tratamiento === id);
  return (row.receta as Row | null)?.id_receta === id;
}

function itemOf(row: Row, entidad: ClinicalItemEntity, id: number): ClinicalItemDto | null {
  if (entidad === 'diagnostico') {
    const item = diagnosticos(row).find((d) => d.id_diagnostico === id);
    return item ? { entidad, item } : null;
  }
  if (entidad === 'tratamiento') {
    const item = tratamientos(row).find((t) => t.id_tratamiento === id);
    return item ? { entidad, item } : null;
  }
  const item = receta(row);
  return item && item.id_receta === id ? { entidad, item } : null;
}

export function createFirebaseClinicalMaintenance(deps: {
  unitOfWork: FirebaseUnitOfWork;
  ids: IdPort;
  id_institucion: InstitutionId;
}): ClinicalMaintenanceMethods {
  const uow = deps.unitOfWork;

  async function readRecord(id_expediente: number): Promise<Row> {
    const record = await uow.read('records', id_expediente);
    if (!record) throw new ClinicalError('not_found', NOT_FOUND);
    return record;
  }

  /** Same serialization point as closeConsulta / archiveExpediente: bump the record revision. */
  async function bumpRecord(id_expediente: number, record: Row): Promise<void> {
    await uow.update('records', id_expediente, {
      revision: Number(record.revision ?? 0) + 1,
    });
  }

  async function findHolder(entidad: ClinicalItemEntity, id: number): Promise<Row | null> {
    const rows = await uow.query('consultations', (row) => embeds(row, entidad, id));
    return rows[0] ?? null;
  }

  return {
    async findConsultaParaCierre(id_consulta: number): Promise<ConsultaParaCierre | null> {
      return uow.runInTransaction(async () => {
        const row = await uow.read('consultations', id_consulta);
        if (!row) return null;
        const record = await uow.read('records', row.id_expediente);
        if (!record) return null;
        return {
          consulta: consultaDto(row),
          expediente_estado: record.estado as ExpedienteEstado,
        };
      });
    },

    async guardarCierreConsulta(
      id_consulta: number,
      bundle: CierreConsultaBundle,
    ): Promise<ConsultaCompleta> {
      return uow.runInTransaction(async () => {
        const row = await uow.read('consultations', id_consulta);
        if (!row) throw new ClinicalError('not_found', NOT_FOUND);
        if (row.estado !== 'abierta') throw new ClinicalError('conflict', CONFLICT);
        const record = await readRecord(row.id_expediente);
        if (record.estado === 'archivado')
          throw new ClinicalError('expediente_archived', 'El expediente está archivado');
        for (const dx of bundle.diagnosticos) {
          if (dx.codigo_cie10 && !(await uow.read('cie10', dx.codigo_cie10)))
            throw new ClinicalError('reference_not_found', REFERENCE_NOT_FOUND);
        }
        for (const detail of bundle.receta?.detalles ?? []) {
          if ((await uow.read('medications', detail.id_medicamento))?.activo !== true)
            throw new ClinicalError('reference_not_found', REFERENCE_NOT_FOUND);
        }
        const consultaId = row.id_consulta as ConsultaDto['id_consulta'];
        const newDiagnosticos: DiagnosticoDto[] = [];
        for (const dx of bundle.diagnosticos) {
          newDiagnosticos.push({
            ...dx,
            id_diagnostico: (await deps.ids.nextInt('diagnostico')) as DiagnosticoId,
            id_consulta: consultaId,
          });
        }
        const newTratamientos: TratamientoDto[] = [];
        for (const tx of bundle.tratamientos) {
          const { diagnostico_index, ...data } = tx;
          const parent = newDiagnosticos[diagnostico_index];
          if (!parent) throw new ClinicalError('invalid_bundle', 'Índice de diagnóstico inválido');
          newTratamientos.push({
            ...data,
            id_tratamiento: (await deps.ids.nextInt('tratamiento')) as TratamientoId,
            id_diagnostico: parent.id_diagnostico,
          });
        }
        const newReceta: RecetaDto | null = bundle.receta
          ? {
              ...bundle.receta.header,
              id_consulta: consultaId,
              id_receta: (await deps.ids.nextInt('receta')) as RecetaId,
            }
          : null;
        const newDetalles: DetalleRecetaDto[] = newReceta
          ? bundle
              .receta!.detalles.map((d) => ({ ...d, id_receta: newReceta.id_receta }))
              .sort((a, b) => a.id_medicamento - b.id_medicamento)
          : [];
        const document = toFirestore({
          ...row,
          estado: 'cerrada',
          fecha_hora_fin: bundle.fecha_hora_fin,
          enfermedad_actual: bundle.enfermedad_actual,
          exploracion_fisica: bundle.exploracion_fisica,
          plan: bundle.plan,
          diagnosticos: [...diagnosticos(row), ...newDiagnosticos],
          tratamientos: [...tratamientos(row), ...newTratamientos],
          receta: newReceta ?? receta(row),
          detalles: newReceta ? newDetalles : (row.detalles ?? []),
        }) as Row;
        if (Buffer.byteLength(JSON.stringify(document), 'utf8') > MAX_DOC_BYTES)
          throw new ClinicalError(
            'invalid_bundle',
            'Consultation bundle exceeds 256 KiB UTF-8 JSON',
          );
        await bumpRecord(row.id_expediente, record);
        uow.set('consultations', id_consulta, document);
        return complete(document);
      });
    },

    async findClinicalItem(
      entidad: ClinicalItemEntity,
      id: number,
    ): Promise<ClinicalItemSnapshot | null> {
      return uow.runInTransaction(async () => {
        const row = await findHolder(entidad, id);
        if (!row) return null;
        const item = itemOf(row, entidad, id);
        if (!item) return null;
        const record = await uow.read('records', row.id_expediente as number);
        if (!record) return null;
        return {
          item,
          id_consulta: Number(row.id_consulta),
          consulta_estado: String(row.estado),
          expediente_estado: record.estado as ExpedienteEstado,
        };
      });
    },

    async updateClinicalItem(patch: ClinicalItemPatch): Promise<ClinicalItemDto> {
      return uow.runInTransaction(async () => {
        const row = await findHolder(patch.entidad, patch.id);
        if (!row) throw new ClinicalError('not_found', NOT_FOUND);
        const changes: Row = {};
        if (patch.entidad === 'diagnostico') {
          if (patch.tipo !== undefined) changes.tipo = patch.tipo;
          if (patch.descripcion !== undefined) changes.descripcion = patch.descripcion;
        } else if (patch.entidad === 'tratamiento') {
          if (patch.estado !== undefined) changes.estado = patch.estado;
          if (patch.indicaciones !== undefined) changes.indicaciones = patch.indicaciones;
          if (patch.fecha_fin_estimada !== undefined)
            changes.fecha_fin_estimada = patch.fecha_fin_estimada;
        } else {
          if (patch.estado !== undefined) changes.estado = patch.estado;
          if (patch.observaciones !== undefined) changes.observaciones = patch.observaciones;
        }
        if (Object.keys(changes).length === 0)
          throw new ClinicalError('invalid_body', 'Solicitud inválida');
        const next: Row = { ...row };
        if (patch.entidad === 'diagnostico') {
          next.diagnosticos = ((row.diagnosticos as Row[] | null) ?? []).map((d) =>
            d.id_diagnostico === patch.id ? { ...d, ...changes } : d,
          );
        } else if (patch.entidad === 'tratamiento') {
          next.tratamientos = ((row.tratamientos as Row[] | null) ?? []).map((t) =>
            t.id_tratamiento === patch.id ? { ...t, ...changes } : t,
          );
        } else {
          next.receta = { ...(row.receta as Row), ...changes };
        }
        const record = await readRecord(row.id_expediente as number);
        await bumpRecord(row.id_expediente as number, record);
        uow.set('consultations', row.id_consulta as number, toFirestore(next) as Row);
        const updated = itemOf(next, patch.entidad, patch.id);
        if (!updated) throw new ClinicalError('not_found', NOT_FOUND);
        return structuredClone(updated);
      });
    },

    async appendBitacora(entry: BitacoraClinicaEntry): Promise<void> {
      // BITACORA (Entrega I) lives in this institution's Firestore next to the clinical
      // documents, so the audit row commits atomically with the clinical change.
      await uow.runInTransaction(async () => {
        const id_bitacora = await deps.ids.nextInt('bitacora');
        await uow.create(
          'bitacora',
          id_bitacora,
          toFirestore({
            id_bitacora,
            id_institucion: deps.id_institucion,
            id_usuario: entry.id_usuario,
            entidad: entry.entidad,
            id_registro: entry.id_registro,
            accion: entry.accion,
            fecha_hora: entry.fecha_hora,
            direccion_ip: null,
            detalle: entry.detalle,
          }) as Row,
        );
      });
    },
  };
}

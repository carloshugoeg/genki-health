/** Memory (tests/dev only): OP-31 close + audited corrections on the snapshot maps. */
import {
  asConsultaId,
  type ConsultaCompleta,
  type ConsultaDto,
  type DetalleRecetaDto,
  type DiagnosticoDto,
  type DiagnosticoId,
  type ExpedienteDto,
  type RecetaDto,
  type RecetaId,
  type TratamientoDto,
  type TratamientoId,
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
import { getExtensionNamespace, putExtensionRow } from '../full-state.js';
import type { MemoryInstitutionState, MemoryMaps } from '../state.js';
import { activeMemoryMaps } from '../unit-of-work.js';

const NOT_FOUND = 'Recurso no encontrado';
const REFERENCE_NOT_FOUND = 'Referencia de catálogo no encontrada';

export type MemoryClinicalMaintenance = Pick<
  ConsultationRepositoryPort,
  | 'findConsultaParaCierre'
  | 'guardarCierreConsulta'
  | 'findClinicalItem'
  | 'updateClinicalItem'
  | 'appendBitacora'
>;

function clone<T>(value: T): T {
  return structuredClone(value);
}

function expedienteOf(maps: MemoryMaps, id_expediente: number): ExpedienteDto | null {
  for (const row of maps.expedientes.values()) if (row.id_expediente === id_expediente) return row;
  return null;
}

function tableOf(maps: MemoryMaps, entidad: ClinicalItemEntity): Map<number, unknown> {
  return entidad === 'diagnostico'
    ? maps.diagnosticos
    : entidad === 'tratamiento'
      ? maps.tratamientos
      : maps.recetas;
}

function active(row: unknown): boolean {
  return typeof row === 'object' && row !== null && (row as { activo?: boolean }).activo !== false;
}

export function createMemoryClinicalMaintenance(deps: {
  state: MemoryInstitutionState;
  ids: IdPort;
}): MemoryClinicalMaintenance {
  function consultaContext(maps: MemoryMaps, id_consulta: number) {
    const consulta = maps.consultas.get(id_consulta) as ConsultaDto | undefined;
    if (!consulta) return null;
    const expediente = expedienteOf(maps, consulta.id_expediente);
    if (!expediente) return null;
    return { consulta, expediente };
  }

  return {
    async findConsultaParaCierre(id_consulta): Promise<ConsultaParaCierre | null> {
      const found = consultaContext(activeMemoryMaps(deps.state), id_consulta);
      if (!found) return null;
      return { consulta: clone(found.consulta), expediente_estado: found.expediente.estado };
    },

    async guardarCierreConsulta(
      id_consulta,
      bundle: CierreConsultaBundle,
    ): Promise<ConsultaCompleta> {
      const maps = activeMemoryMaps(deps.state);
      const found = consultaContext(maps, id_consulta);
      if (!found) throw new ClinicalError('not_found', NOT_FOUND);
      if (found.consulta.estado !== 'abierta')
        throw new ClinicalError('conflict', 'Conflicto de recurso');
      for (const dx of bundle.diagnosticos)
        if (dx.codigo_cie10 && !maps.catalogs.cie10.has(dx.codigo_cie10))
          throw new ClinicalError('reference_not_found', REFERENCE_NOT_FOUND);
      for (const d of bundle.receta?.detalles ?? [])
        if (!active(maps.catalogs.medicamentos.get(d.id_medicamento)))
          throw new ClinicalError('reference_not_found', REFERENCE_NOT_FOUND);

      const cid = asConsultaId(id_consulta);
      const diagnosticos: DiagnosticoDto[] = [];
      for (const dx of bundle.diagnosticos) {
        const row: DiagnosticoDto = {
          ...dx,
          id_diagnostico: (await deps.ids.nextInt('diagnostico')) as DiagnosticoId,
          id_consulta: cid,
        };
        maps.diagnosticos.set(row.id_diagnostico, row);
        diagnosticos.push(clone(row));
      }
      const tratamientos: TratamientoDto[] = [];
      for (const { diagnostico_index, ...tx } of bundle.tratamientos) {
        const parent = diagnosticos[diagnostico_index];
        if (!parent) throw new ClinicalError('invalid_bundle', 'Índice de diagnóstico inválido');
        const row: TratamientoDto = {
          ...tx,
          id_tratamiento: (await deps.ids.nextInt('tratamiento')) as TratamientoId,
          id_diagnostico: parent.id_diagnostico,
        };
        maps.tratamientos.set(row.id_tratamiento, row);
        tratamientos.push(clone(row));
      }
      let receta: RecetaDto | null = null;
      const detalles: DetalleRecetaDto[] = [];
      if (bundle.receta) {
        receta = {
          ...bundle.receta.header,
          id_receta: (await deps.ids.nextInt('receta')) as RecetaId,
          id_consulta: cid,
        };
        maps.recetas.set(receta.id_receta, receta);
        for (const d of bundle.receta.detalles) {
          const row: DetalleRecetaDto = { ...d, id_receta: receta.id_receta };
          maps.detalles.set(`${receta.id_receta}:${d.id_medicamento}`, row);
          detalles.push(clone(row));
        }
        receta = clone(receta);
      }
      const closed: ConsultaDto = {
        ...found.consulta,
        estado: 'cerrada',
        fecha_hora_fin: bundle.fecha_hora_fin,
        enfermedad_actual: bundle.enfermedad_actual,
        exploracion_fisica: bundle.exploracion_fisica,
        plan: bundle.plan,
      };
      maps.consultas.set(id_consulta, closed);
      return { consulta: clone(closed), diagnosticos, tratamientos, receta, detalles };
    },

    async findClinicalItem(entidad, id): Promise<ClinicalItemSnapshot | null> {
      const maps = activeMemoryMaps(deps.state);
      const row = tableOf(maps, entidad).get(id);
      if (!row) return null;
      const id_consulta =
        entidad === 'tratamiento'
          ? (maps.diagnosticos.get((row as TratamientoDto).id_diagnostico) as DiagnosticoDto)
              .id_consulta
          : (row as DiagnosticoDto | RecetaDto).id_consulta;
      const found = consultaContext(maps, id_consulta);
      if (!found) return null;
      return {
        item: { entidad, item: clone(row) } as ClinicalItemDto,
        id_consulta,
        consulta_estado: found.consulta.estado,
        expediente_estado: found.expediente.estado,
      };
    },

    async updateClinicalItem(patch: ClinicalItemPatch): Promise<ClinicalItemDto> {
      const maps = activeMemoryMaps(deps.state);
      const table = tableOf(maps, patch.entidad);
      const current = table.get(patch.id);
      if (!current) throw new ClinicalError('not_found', NOT_FOUND);
      const { id: _id, entidad, ...fields } = patch;
      const next = { ...(current as object) };
      for (const [key, value] of Object.entries(fields))
        if (value !== undefined) (next as Record<string, unknown>)[key] = value;
      table.set(patch.id, next);
      return { entidad, item: clone(next) } as ClinicalItemDto;
    },

    async appendBitacora(entry: BitacoraClinicaEntry): Promise<void> {
      const ns = getExtensionNamespace(activeMemoryMaps(deps.state), 'consultation');
      const id_bitacora = await deps.ids.nextInt('bitacora');
      putExtensionRow(ns, 'bitacora', id_bitacora, { id_bitacora, ...clone(entry) });
    },
  };
}

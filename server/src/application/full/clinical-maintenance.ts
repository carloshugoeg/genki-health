import type { ConsultaCompleta, ProfesionalId } from '@genki/shared';
import type {
  AnulacionClinicaInput,
  CerrarConsultaInput,
  ClinicalItemDto,
} from '@genki/shared/full/consultation';
import { ClinicalError } from '../../domain/clinical-error.js';
import { validateConsulta } from '../../domain/consulta.js';
import {
  OP_BY_ENTITY,
  assertAmendable,
  assertClinicalMaintenanceRole,
  assertClosable,
  planAnulacion,
  planModificacion,
  type AmendmentPlan,
  type Cambios,
  type ClinicalItemEntity,
  type ItemValues,
} from '../../domain/full/clinical-maintenance.js';
import type { FullContext, OperationContext } from '../../ports/full/context.js';
import type { CierreConsultaBundle, ClinicalItemSnapshot } from '../../ports/full/consultation.js';

function rethrow(err: unknown): never {
  if (err instanceof ClinicalError) throw err;
  throw new ClinicalError('internal_error', 'Error interno');
}

function positiveId(value: unknown): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 1 || value > 2_147_483_647)
    throw new ClinicalError('invalid_query', 'Parámetros inválidos');
  return value;
}

/**
 * OP-31 Cerrar consulta: an open consultation (OP-26) receives its diagnoses, treatments and
 * optional prescription and becomes `cerrada` in ONE transaction, with a BITACORA row. Same
 * structural rules as the closed-consultation composer (validateConsulta).
 */
export async function executeCerrarConsulta(
  context: FullContext,
  input: { params: { id: number }; body: CerrarConsultaInput },
  actor: OperationContext,
): Promise<ConsultaCompleta> {
  assertClinicalMaintenanceRole(actor.roles);
  const id_consulta = positiveId(input.params.id);
  const body = input.body;
  const consultation = context.modules.consultation;
  try {
    return await context.unitOfWork.runInTransaction(async () => {
      const found = await consultation.findConsultaParaCierre(id_consulta);
      if (!found) throw new ClinicalError('not_found', 'Recurso no encontrado');
      assertClosable({
        consulta_estado: found.consulta.estado,
        expediente_estado: found.expediente_estado,
      });
      const nowIso = actor.now || context.clock.nowIso();
      validateConsulta(
        {
          fecha_hora_inicio: found.consulta.fecha_hora_inicio,
          diagnosticos: body.diagnosticos,
          tratamientos: body.tratamientos,
          receta: body.receta ?? null,
        },
        nowIso,
      );
      if (body.receta) {
        const catalogs = await context.base.catalogos.list();
        const meds = new Set(catalogs.medicamentos.map((m) => m.id_medicamento));
        for (const d of body.receta.detalles)
          if (!meds.has(d.id_medicamento))
            throw new ClinicalError('reference_not_found', 'Medicamento no encontrado');
      }
      const id_profesional = found.consulta.id_profesional as ProfesionalId;
      const bundle: CierreConsultaBundle = {
        fecha_hora_fin: nowIso,
        enfermedad_actual: body.enfermedad_actual ?? null,
        exploracion_fisica: body.exploracion_fisica ?? null,
        plan: body.plan ?? null,
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
                  folio: `REC-${await context.ids.nextInt('receta_folio')}`,
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
      const closed = await consultation.guardarCierreConsulta(id_consulta, bundle);
      await consultation.appendBitacora({
        id_usuario: actor.id_usuario,
        entidad: 'consulta',
        id_registro: String(id_consulta),
        accion: 'modificacion',
        fecha_hora: nowIso,
        detalle: {
          op: OP_BY_ENTITY.consulta,
          resultado: 'ok',
          operacion: 'cierre',
          campos: ['estado', 'fecha_hora_fin'],
          motivo: null,
          id_consulta,
          antes: { estado: 'abierta', fecha_hora_fin: null },
          despues: { estado: 'cerrada', fecha_hora_fin: closed.consulta.fecha_hora_fin },
        },
      });
      return closed;
    });
  } catch (err) {
    rethrow(err);
  }
}

function toValues(snapshot: ClinicalItemSnapshot): ItemValues {
  const { item } = snapshot;
  if (item.entidad === 'diagnostico')
    return {
      entidad: 'diagnostico',
      values: { tipo: item.item.tipo, descripcion: item.item.descripcion },
    };
  if (item.entidad === 'tratamiento')
    return {
      entidad: 'tratamiento',
      values: {
        estado: item.item.estado,
        indicaciones: item.item.indicaciones,
        fecha_inicio: item.item.fecha_inicio,
        fecha_fin_estimada: item.item.fecha_fin_estimada,
      },
    };
  return {
    entidad: 'receta',
    values: { estado: item.item.estado, observaciones: item.item.observaciones },
  };
}

async function amend(
  context: FullContext,
  entidad: ClinicalItemEntity,
  id: number,
  motivo: string,
  operacion: 'modificacion' | 'anulacion',
  plan: (current: ItemValues) => AmendmentPlan,
  actor: OperationContext,
): Promise<ClinicalItemDto> {
  assertClinicalMaintenanceRole(actor.roles);
  const itemId = positiveId(id);
  const consultation = context.modules.consultation;
  try {
    return await context.unitOfWork.runInTransaction(async () => {
      const snapshot = await consultation.findClinicalItem(entidad, itemId);
      if (!snapshot) throw new ClinicalError('not_found', 'Recurso no encontrado');
      assertAmendable(snapshot);
      const planned = plan(toValues(snapshot));
      const updated = await consultation.updateClinicalItem({ id: itemId, ...planned.patch });
      await consultation.appendBitacora({
        id_usuario: actor.id_usuario,
        entidad,
        id_registro: String(itemId),
        accion: 'modificacion',
        fecha_hora: actor.now || context.clock.nowIso(),
        detalle: {
          op: OP_BY_ENTITY[entidad],
          resultado: 'ok',
          operacion,
          campos: planned.campos,
          motivo,
          id_consulta: snapshot.id_consulta,
          antes: planned.antes,
          despues: planned.despues,
        },
      });
      return updated;
    });
  } catch (err) {
    rethrow(err);
  }
}

/** Audited correction of a diagnosis / treatment / prescription (status or annotation fields). */
export async function executeModificarItemClinico(
  context: FullContext,
  input: { params: { id: number }; body: { motivo: string; cambios: Cambios } },
  actor: OperationContext,
): Promise<ClinicalItemDto> {
  const { motivo, cambios } = input.body;
  return amend(
    context,
    cambios.entidad,
    input.params.id,
    motivo,
    'modificacion',
    (current) => planModificacion(current, cambios),
    actor,
  );
}

/** Annulment = the entity's own terminal status (descartado / suspendido / anulada); never DELETE. */
export async function executeAnularItemClinico(
  context: FullContext,
  input: { params: { id: number }; body: AnulacionClinicaInput },
  actor: OperationContext,
): Promise<ClinicalItemDto> {
  return amend(
    context,
    input.body.entidad,
    input.params.id,
    input.body.motivo,
    'anulacion',
    (current) => planAnulacion(current),
    actor,
  );
}

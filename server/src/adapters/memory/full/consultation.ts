import { createHash } from 'node:crypto';
import { asConsultaId, asPacienteId, type ConsultaDto, type ExpedienteId } from '@genki/shared';
import type {
  ConsultaDraft,
  FullConsultaDto,
  SIGNOS_VITALES,
} from '@genki/shared/full/consultation';
import { ClinicalError } from '../../../domain/clinical-error.js';
import type { ClockPort } from '../../../ports/clock.js';
import type { IdPort } from '../../../ports/id.js';
import type { PacienteRepositoryPort } from '../../../ports/paciente-repository.js';
import type { UnitOfWorkPort } from '../../../ports/unit-of-work.js';
import type { OperationContext } from '../../../ports/full/context.js';
import type {
  ConsultationRepositoryPort,
  Op26Request,
  Op26Response,
  Op27Request,
  Op27Response,
  Op28Request,
  Op28Response,
  Op29Request,
  Op29Response,
  Op30Request,
  Op30Response,
  Op31Request,
  Op31Response,
  Op32Request,
  Op32Response,
  Op33Request,
  Op33Response,
} from '../../../ports/full/consultation.js';
import {
  getExtensionNamespace,
  putExtensionRow,
  type MemoryExtensionNamespace,
} from '../full-state.js';
import type { MemoryInstitutionState } from '../state.js';
import { activeMemoryMaps } from '../unit-of-work.js';
import { createMemoryClinicalMaintenance } from './clinical-maintenance.js';

const NOT_FOUND = 'Recurso no encontrado';
const ARCHIVED = 'Expediente archivado';
const CONFLICT = 'Conflicto de recurso';
const STORE_DOWN = 'Almacenamiento no disponible';
const LATER = 'OP belongs to a later consultation chunk';

type IdempotencyRow = {
  key: string;
  id_usuario: number;
  payload_hash: string;
  response: ConsultaDraft | SIGNOS_VITALES;
};

type DraftRow = {
  id_consulta: number;
  revision: number;
  diagnosticos: ConsultaDraft['diagnosticos'];
  tratamientos: ConsultaDraft['tratamientos'];
  receta: ConsultaDraft['receta'];
};

export type MemoryConsultationDeps = {
  state: MemoryInstitutionState;
  pacientes: PacienteRepositoryPort;
  ids: IdPort;
  unitOfWork: UnitOfWorkPort;
  clock: ClockPort;
  isStoreUnavailable: () => boolean;
  afterWrite: () => void;
};

function cloneDto<T>(value: T): T {
  return structuredClone(value);
}

function payloadHash(body: unknown): string {
  return createHash('sha256').update(JSON.stringify(body)).digest('hex');
}

function assertStore(isStoreUnavailable: () => boolean): void {
  if (isStoreUnavailable()) {
    throw new ClinicalError('store_unavailable', STORE_DOWN);
  }
}

function listTable<T>(namespace: MemoryExtensionNamespace, table: string): T[] {
  const rows = namespace.get(table);
  if (!rows) return [];
  return [...rows.values()].map((row) => cloneDto(row as T));
}

function professionalActive(state: MemoryInstitutionState, id_profesional: number): boolean {
  const row = activeMemoryMaps(state).catalogs.profesionales.get(id_profesional);
  if (!row || typeof row !== 'object') return false;
  return (row as { activo?: boolean }).activo !== false;
}

function toFullConsulta(row: ConsultaDto): FullConsultaDto {
  return {
    ...row,
    estado: row.estado as FullConsultaDto['estado'],
    tipo: row.tipo as FullConsultaDto['tipo'],
  };
}

function toDraft(consulta: ConsultaDto, draft: DraftRow): ConsultaDraft {
  return {
    consulta: toFullConsulta(consulta),
    revision: draft.revision,
    diagnosticos: cloneDto(draft.diagnosticos),
    tratamientos: cloneDto(draft.tratamientos),
    receta: cloneDto(draft.receta),
  };
}

export function createMemoryConsultationRepository(
  deps: MemoryConsultationDeps,
): ConsultationRepositoryPort & { resetForTests: () => void } {
  const idempotencyIndex = new Map<string, string>();

  function namespace(): MemoryExtensionNamespace {
    return getExtensionNamespace(activeMemoryMaps(deps.state), 'consultation');
  }

  function wrapWriteFailure(err: unknown): never {
    if (err instanceof ClinicalError) throw err;
    throw new ClinicalError('internal_error', 'Error interno');
  }

  async function replayOrStart<T extends ConsultaDraft | SIGNOS_VITALES>(
    context: OperationContext,
    body: unknown,
    create: () => Promise<T>,
  ): Promise<T> {
    const key = context.idempotency_key;
    if (!key) throw new ClinicalError('invalid_body', 'Solicitud inválida');
    const hash = payloadHash(body);
    const idemKey = `${context.id_usuario}:${key}`;

    try {
      return await deps.unitOfWork.runInTransaction(async () => {
        const existingId = idempotencyIndex.get(idemKey);
        if (existingId) {
          const prior = namespace().get('idempotency')?.get(existingId) as
            IdempotencyRow | undefined;
          if (!prior) throw new ClinicalError('internal_error', 'Error interno');
          if (prior.payload_hash !== hash) {
            throw new ClinicalError('conflict', 'Conflicto de idempotencia');
          }
          return cloneDto(prior.response as T);
        }

        const created = await create();
        putExtensionRow(namespace(), 'idempotency', idemKey, {
          key,
          id_usuario: context.id_usuario,
          payload_hash: hash,
          response: cloneDto(created),
        } satisfies IdempotencyRow);
        idempotencyIndex.set(idemKey, idemKey);
        try {
          deps.afterWrite();
        } catch (err) {
          wrapWriteFailure(err);
        }
        return cloneDto(created);
      });
    } catch (err) {
      if (err instanceof ClinicalError) throw err;
      wrapWriteFailure(err);
    }
  }

  const unsupported = async (): Promise<never> => {
    throw new ClinicalError('misconfigured', LATER);
  };

  const repo: ConsultationRepositoryPort & { resetForTests: () => void } = {
    resetForTests(): void {
      idempotencyIndex.clear();
    },

    async op26(input: Op26Request, context: OperationContext): Promise<Op26Response> {
      assertStore(deps.isStoreUnavailable);
      return replayOrStart(context, input.body, async () => {
        const idPaciente = asPacienteId(input.params.id);
        const paciente = await deps.pacientes.findById(idPaciente);
        if (!paciente) throw new ClinicalError('not_found', NOT_FOUND);
        const expediente = await deps.pacientes.findExpedienteByPaciente(idPaciente);
        if (!expediente) throw new ClinicalError('not_found', NOT_FOUND);
        if (expediente.estado === 'archivado') {
          throw new ClinicalError('expediente_archived', ARCHIVED);
        }
        if (!professionalActive(deps.state, input.body.id_profesional)) {
          throw new ClinicalError('reference_not_found', NOT_FOUND);
        }
        if (input.body.id_cita != null) {
          throw new ClinicalError('invalid_body', 'Solicitud inválida');
        }

        const maps = activeMemoryMaps(deps.state);
        for (const row of maps.consultas.values()) {
          if (
            typeof row === 'object' &&
            row !== null &&
            (row as ConsultaDto).id_expediente === expediente.id_expediente &&
            (row as ConsultaDto).estado === 'abierta'
          ) {
            throw new ClinicalError('conflict', CONFLICT);
          }
        }

        const id_consulta = asConsultaId(await deps.ids.nextInt('consulta'));
        const consulta: ConsultaDto = {
          id_consulta,
          id_expediente: expediente.id_expediente as ExpedienteId,
          id_profesional: input.body.id_profesional as ConsultaDto['id_profesional'],
          id_cita: null,
          fecha_hora_inicio: input.body.fecha_hora_inicio,
          fecha_hora_fin: null,
          tipo: input.body.tipo,
          motivo_consulta: input.body.motivo_consulta,
          enfermedad_actual: null,
          exploracion_fisica: null,
          plan: null,
          estado: 'abierta',
        };
        maps.consultas.set(id_consulta, cloneDto(consulta));

        const draft: DraftRow = {
          id_consulta,
          revision: 1,
          diagnosticos: [],
          tratamientos: [],
          receta: null,
        };
        putExtensionRow(namespace(), 'borradores', id_consulta, draft);
        return toDraft(consulta, draft);
      });
    },

    async op27(input: Op27Request, context: OperationContext): Promise<Op27Response> {
      assertStore(deps.isStoreUnavailable);
      return replayOrStart(context, input.body, async () => {
        const id_consulta = asConsultaId(input.params.id);
        const maps = activeMemoryMaps(deps.state);
        const consulta = maps.consultas.get(id_consulta) as ConsultaDto | undefined;
        if (!consulta) throw new ClinicalError('not_found', NOT_FOUND);
        if (consulta.estado !== 'abierta') {
          throw new ClinicalError('conflict', CONFLICT);
        }

        const existing = listTable<SIGNOS_VITALES>(namespace(), 'signos').find(
          (row) => row.id_consulta === id_consulta,
        );
        if (existing) throw new ClinicalError('conflict', CONFLICT);

        const id_signos = await deps.ids.nextInt('signos_vitales');
        const row: SIGNOS_VITALES = {
          id_signos,
          id_consulta,
          fecha_hora_toma: context.now || deps.clock.nowIso(),
          ...(input.body.presion_sistolica !== undefined
            ? { presion_sistolica: input.body.presion_sistolica }
            : {}),
          ...(input.body.presion_diastolica !== undefined
            ? { presion_diastolica: input.body.presion_diastolica }
            : {}),
          ...(input.body.frecuencia_cardiaca !== undefined
            ? { frecuencia_cardiaca: input.body.frecuencia_cardiaca }
            : {}),
          ...(input.body.frecuencia_respiratoria !== undefined
            ? { frecuencia_respiratoria: input.body.frecuencia_respiratoria }
            : {}),
          ...(input.body.temperatura_c !== undefined
            ? { temperatura_c: input.body.temperatura_c }
            : {}),
          ...(input.body.saturacion_oxigeno !== undefined
            ? { saturacion_oxigeno: input.body.saturacion_oxigeno }
            : {}),
          ...(input.body.peso_kg !== undefined ? { peso_kg: input.body.peso_kg } : {}),
          ...(input.body.talla_cm !== undefined ? { talla_cm: input.body.talla_cm } : {}),
        };
        putExtensionRow(namespace(), 'signos', id_signos, row);
        return row;
      });
    },

    op28: unsupported as (input: Op28Request, context: OperationContext) => Promise<Op28Response>,
    op29: unsupported as (input: Op29Request, context: OperationContext) => Promise<Op29Response>,
    op30: unsupported as (input: Op30Request, context: OperationContext) => Promise<Op30Response>,
    op31: unsupported as (input: Op31Request, context: OperationContext) => Promise<Op31Response>,
    op32: unsupported as (input: Op32Request, context: OperationContext) => Promise<Op32Response>,
    op33: unsupported as (input: Op33Request, context: OperationContext) => Promise<Op33Response>,
    ...createMemoryClinicalMaintenance({ state: deps.state, ids: deps.ids }),
  };

  return repo;
}

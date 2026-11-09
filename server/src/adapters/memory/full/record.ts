import { createHash } from 'node:crypto';
import { asPacienteId, type ExpedienteDto } from '@genki/shared';
import type { FichaCompleta } from '@genki/shared/full/patient';
import type { ALERGIA, ANTECEDENTE } from '@genki/shared/full/record';
import { ClinicalError } from '../../../domain/clinical-error.js';
import type { ClockPort } from '../../../ports/clock.js';
import type { IdPort } from '../../../ports/id.js';
import type { PacienteRepositoryPort } from '../../../ports/paciente-repository.js';
import type { UnitOfWorkPort } from '../../../ports/unit-of-work.js';
import type { OperationContext } from '../../../ports/full/context.js';
import type {
  Op12Request,
  Op12Response,
  Op15Request,
  Op15Response,
  Op16Request,
  Op16Response,
  Op18Request,
  Op18Response,
  Op19Request,
  Op19Response,
  RecordRepositoryPort,
} from '../../../ports/full/record.js';
import {
  getExtensionNamespace,
  putExtensionRow,
  type MemoryExtensionNamespace,
} from '../full-state.js';
import type { MemoryInstitutionState } from '../state.js';
import { activeMemoryMaps } from '../unit-of-work.js';

const NOT_FOUND = 'Recurso no encontrado';
const ARCHIVED = 'Expediente archivado';
const ALREADY_ARCHIVED = 'El expediente ya está archivado';
const CONFLICT = 'Conflicto de recurso';
const STORE_DOWN = 'Almacenamiento no disponible';

type IdempotencyRow = {
  key: string;
  id_usuario: number;
  payload_hash: string;
  response: ANTECEDENTE | ALERGIA | ExpedienteDto;
};

export type MemoryRecordDeps = {
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

function listTable<T>(namespace: MemoryExtensionNamespace, table: string): T[] {
  const rows = namespace.get(table);
  if (!rows) {
    return [];
  }
  return [...rows.values()].map((row) => cloneDto(row as T));
}

function assertStore(isStoreUnavailable: () => boolean): void {
  if (isStoreUnavailable()) {
    throw new ClinicalError('store_unavailable', STORE_DOWN);
  }
}

function normalizeSustancia(value: string): string {
  return value.trim().toUpperCase();
}

function hasOpenConsulta(state: MemoryInstitutionState, id_expediente: number): boolean {
  const maps = activeMemoryMaps(state);
  for (const row of maps.consultas.values()) {
    if (typeof row !== 'object' || row === null) {
      continue;
    }
    const consulta = row as { id_expediente?: number; estado?: string };
    if (consulta.id_expediente === id_expediente && consulta.estado === 'abierta') {
      return true;
    }
  }
  return false;
}

function hasActiveAdmission(state: MemoryInstitutionState, id_expediente: number): boolean {
  const maps = activeMemoryMaps(state);
  const admission = maps.extensions?.get('admission');
  if (!admission) {
    return false;
  }
  for (const table of admission.values()) {
    for (const row of table.values()) {
      if (typeof row !== 'object' || row === null) {
        continue;
      }
      const adm = row as { id_expediente?: number; estado?: string };
      if (adm.id_expediente === id_expediente && adm.estado === 'activa') {
        return true;
      }
    }
  }
  return false;
}

export function createMemoryRecordRepository(deps: MemoryRecordDeps): RecordRepositoryPort & {
  resetForTests: () => void;
} {
  const idempotencyIndex = new Map<string, string>();

  function namespace(): MemoryExtensionNamespace {
    return getExtensionNamespace(activeMemoryMaps(deps.state), 'record');
  }

  function wrapWriteFailure(err: unknown): never {
    if (err instanceof ClinicalError) {
      throw err;
    }
    throw new ClinicalError('internal_error', 'Error interno');
  }

  async function replayOrStart<T extends ANTECEDENTE | ALERGIA | ExpedienteDto>(
    context: OperationContext,
    body: unknown,
    create: () => Promise<T>,
  ): Promise<T> {
    const key = context.idempotency_key;
    if (!key) {
      throw new ClinicalError('invalid_body', 'Solicitud inválida');
    }
    const hash = payloadHash(body);
    const idemKey = `${context.id_usuario}:${key}`;

    try {
      return await deps.unitOfWork.runInTransaction(async () => {
        const existingId = idempotencyIndex.get(idemKey);
        if (existingId) {
          const ns = namespace();
          const prior = ns.get('idempotency')?.get(existingId) as IdempotencyRow | undefined;
          if (!prior) {
            throw new ClinicalError('internal_error', 'Error interno');
          }
          if (prior.payload_hash !== hash) {
            throw new ClinicalError('conflict', 'Conflicto de idempotencia');
          }
          return cloneDto(prior.response as T);
        }

        const created = await create();
        const ns = namespace();
        const idemRow: IdempotencyRow = {
          key,
          id_usuario: context.id_usuario,
          payload_hash: hash,
          response: cloneDto(created),
        };
        putExtensionRow(ns, 'idempotency', idemKey, idemRow);
        idempotencyIndex.set(idemKey, idemKey);

        try {
          deps.afterWrite();
        } catch (err) {
          wrapWriteFailure(err);
        }

        return cloneDto(created);
      });
    } catch (err) {
      if (err instanceof ClinicalError) {
        throw err;
      }
      wrapWriteFailure(err);
    }
  }

  const repo: RecordRepositoryPort & { resetForTests: () => void } = {
    resetForTests(): void {
      idempotencyIndex.clear();
    },

    async op12(input: Op12Request, _context: OperationContext): Promise<Op12Response> {
      assertStore(deps.isStoreUnavailable);
      return deps.unitOfWork.runInTransaction(async () => {
        const idPaciente = asPacienteId(input.params.id);
        const paciente = await deps.pacientes.findById(idPaciente);
        if (!paciente) {
          throw new ClinicalError('not_found', NOT_FOUND);
        }
        const expediente = await deps.pacientes.findExpedienteByPaciente(idPaciente);
        if (!expediente) {
          throw new ClinicalError('not_found', NOT_FOUND);
        }
        const ns = namespace();
        const antecedentes = listTable<ANTECEDENTE>(ns, 'antecedentes').filter(
          (row) => row.id_expediente === expediente.id_expediente,
        );
        const alergias = listTable<ALERGIA>(ns, 'alergias').filter(
          (row) => row.id_expediente === expediente.id_expediente,
        );
        const ficha: FichaCompleta = {
          paciente: cloneDto(paciente),
          expediente: cloneDto(expediente),
          antecedentes: antecedentes.sort((a, b) => a.id_antecedente - b.id_antecedente),
          alergias: alergias.sort((a, b) => a.id_alergia - b.id_alergia),
          contactos: [],
        };
        return ficha;
      });
    },

    async op15(input: Op15Request, context: OperationContext): Promise<Op15Response> {
      assertStore(deps.isStoreUnavailable);
      return replayOrStart(context, input.body, async () => {
        const idPaciente = asPacienteId(input.params.id);
        const paciente = await deps.pacientes.findById(idPaciente);
        if (!paciente) {
          throw new ClinicalError('not_found', NOT_FOUND);
        }
        const expediente = await deps.pacientes.findExpedienteByPaciente(idPaciente);
        if (!expediente) {
          throw new ClinicalError('not_found', NOT_FOUND);
        }
        if (expediente.estado === 'archivado') {
          throw new ClinicalError('expediente_archived', ARCHIVED);
        }

        const id_antecedente = await deps.ids.nextInt('antecedente');
        const row: ANTECEDENTE = {
          id_antecedente,
          id_expediente: expediente.id_expediente,
          tipo: input.body.tipo,
          descripcion: input.body.descripcion,
          vigente: input.body.vigente,
          fecha_registro: context.now || deps.clock.nowIso(),
          ...(input.body.fecha_inicio !== undefined
            ? { fecha_inicio: input.body.fecha_inicio }
            : {}),
        };

        putExtensionRow(namespace(), 'antecedentes', id_antecedente, row);
        return row;
      });
    },

    async op16(input: Op16Request, context: OperationContext): Promise<Op16Response> {
      assertStore(deps.isStoreUnavailable);
      return replayOrStart(context, input.body, async () => {
        const idPaciente = asPacienteId(input.params.id);
        const paciente = await deps.pacientes.findById(idPaciente);
        if (!paciente) {
          throw new ClinicalError('not_found', NOT_FOUND);
        }
        const expediente = await deps.pacientes.findExpedienteByPaciente(idPaciente);
        if (!expediente) {
          throw new ClinicalError('not_found', NOT_FOUND);
        }
        if (expediente.estado === 'archivado') {
          throw new ClinicalError('expediente_archived', ARCHIVED);
        }

        const normalized = normalizeSustancia(input.body.sustancia);
        const existing = listTable<ALERGIA>(namespace(), 'alergias').find(
          (row) =>
            row.id_expediente === expediente.id_expediente &&
            normalizeSustancia(row.sustancia) === normalized,
        );
        if (existing) {
          throw new ClinicalError('conflict', CONFLICT);
        }

        const id_alergia = await deps.ids.nextInt('alergia');
        const row: ALERGIA = {
          id_alergia,
          id_expediente: expediente.id_expediente,
          sustancia: input.body.sustancia,
          tipo: input.body.tipo,
          severidad: input.body.severidad,
          ...(input.body.reaccion !== undefined ? { reaccion: input.body.reaccion } : {}),
          ...(input.body.fecha_deteccion !== undefined
            ? { fecha_deteccion: input.body.fecha_deteccion }
            : {}),
        };

        putExtensionRow(namespace(), 'alergias', id_alergia, row);
        return row;
      });
    },

    async op18(input: Op18Request, context: OperationContext): Promise<Op18Response> {
      assertStore(deps.isStoreUnavailable);
      return replayOrStart(context, input.body, async () => {
        const idPaciente = asPacienteId(input.params.id);
        const paciente = await deps.pacientes.findById(idPaciente);
        if (!paciente) {
          throw new ClinicalError('not_found', NOT_FOUND);
        }
        const expediente = await deps.pacientes.findExpedienteByPaciente(idPaciente);
        if (!expediente) {
          throw new ClinicalError('not_found', NOT_FOUND);
        }
        if (expediente.estado === 'archivado') {
          throw new ClinicalError('already_archived', ALREADY_ARCHIVED);
        }
        if (hasOpenConsulta(deps.state, expediente.id_expediente)) {
          throw new ClinicalError('conflict', CONFLICT);
        }
        if (hasActiveAdmission(deps.state, expediente.id_expediente)) {
          throw new ClinicalError('conflict', CONFLICT);
        }

        const archived = await deps.pacientes.archiveExpediente({
          id_expediente: expediente.id_expediente,
          motivo_archivo: input.body.motivo_archivo,
          fecha_archivo: context.now || deps.clock.nowIso(),
          ...(input.body.observacion_archivo !== undefined
            ? { observacion_archivo: input.body.observacion_archivo }
            : {}),
        });
        return archived;
      });
    },

    async op19(input: Op19Request, context: OperationContext): Promise<Op19Response> {
      assertStore(deps.isStoreUnavailable);
      return replayOrStart(context, input.body, async () => {
        const idPaciente = asPacienteId(input.params.id);
        const expediente = await deps.pacientes.findExpedienteByPaciente(idPaciente);
        if (!expediente) {
          throw new ClinicalError('not_found', NOT_FOUND);
        }
        if (expediente.estado !== 'archivado') {
          throw new ClinicalError('conflict', CONFLICT);
        }
        const auditId = await deps.ids.nextInt('reactivacion_audit');
        putExtensionRow(namespace(), 'reactivacion_audit', auditId, {
          id: auditId,
          id_expediente: expediente.id_expediente,
          id_usuario: context.id_usuario,
          motivo: input.body.motivo,
          fecha_hora: context.now || deps.clock.nowIso(),
          archivo_previo: {
            fecha_archivo: expediente.fecha_archivo,
            motivo_archivo: expediente.motivo_archivo,
            observacion_archivo: expediente.observacion_archivo,
          },
        });
        return deps.pacientes.reactivateExpediente({ id_expediente: expediente.id_expediente });
      });
    },
  };

  return repo;
}

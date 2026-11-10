import { createHash } from 'node:crypto';
import { asPacienteId } from '@genki/shared';
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
const STORE_DOWN = 'Almacenamiento no disponible';

type IdempotencyRow = {
  key: string;
  id_usuario: number;
  payload_hash: string;
  response: ANTECEDENTE;
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
      const key = context.idempotency_key;
      if (!key) {
        throw new ClinicalError('invalid_body', 'Solicitud inválida');
      }
      const hash = payloadHash(input.body);
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
            return cloneDto(prior.response);
          }

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

          const ns = namespace();
          putExtensionRow(ns, 'antecedentes', id_antecedente, row);
          const idemRow: IdempotencyRow = {
            key,
            id_usuario: context.id_usuario,
            payload_hash: hash,
            response: cloneDto(row),
          };
          putExtensionRow(ns, 'idempotency', idemKey, idemRow);
          idempotencyIndex.set(idemKey, idemKey);

          try {
            deps.afterWrite();
          } catch (err) {
            wrapWriteFailure(err);
          }

          return cloneDto(row);
        });
      } catch (err) {
        if (err instanceof ClinicalError) {
          throw err;
        }
        wrapWriteFailure(err);
      }
    },

    async op16(_input: Op16Request, _context: OperationContext): Promise<Op16Response> {
      throw new ClinicalError('misconfigured', 'OP16 belongs to a later record chunk');
    },

    async op18(_input: Op18Request, _context: OperationContext): Promise<Op18Response> {
      throw new ClinicalError('misconfigured', 'OP18 belongs to a later record chunk');
    },

    async op19(_input: Op19Request, _context: OperationContext): Promise<Op19Response> {
      throw new ClinicalError('misconfigured', 'OP19 belongs to a later record chunk');
    },
  };

  return repo;
}

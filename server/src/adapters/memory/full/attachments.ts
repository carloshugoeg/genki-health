import { createHash } from 'node:crypto';
import { asPacienteId } from '@genki/shared';
import type { DOCUMENTO_ADJUNTO } from '@genki/shared/full/attachments';
import { ClinicalError } from '../../../domain/clinical-error.js';
import type { ClockPort } from '../../../ports/clock.js';
import type { IdPort } from '../../../ports/id.js';
import type { PacienteRepositoryPort } from '../../../ports/paciente-repository.js';
import type { UnitOfWorkPort } from '../../../ports/unit-of-work.js';
import type { OperationContext } from '../../../ports/full/context.js';
import type {
  AttachmentsRepositoryPort,
  Op17Request,
  Op17Response,
} from '../../../ports/full/attachments.js';
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
const INVALID = 'Solicitud inválida';

type IdempotencyRow = {
  key: string;
  id_usuario: number;
  payload_hash: string;
  response: DOCUMENTO_ADJUNTO;
};

type ContenidoRow = {
  id_documento: number;
  bytes: Uint8Array;
};

type TempRow = {
  id_temp: string;
  ruta: string;
};

export type MemoryAttachmentsDeps = {
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

function contentHash(bytes: Uint8Array, id_consulta: number | undefined): string {
  const hash = createHash('sha256');
  hash.update(bytes);
  hash.update('|');
  hash.update(id_consulta === undefined ? '' : String(id_consulta));
  return hash.digest('hex');
}

function sha256Hex(bytes: Uint8Array): string {
  return createHash('sha256').update(bytes).digest('hex');
}

function extensionForMime(mime: string): string {
  if (mime === 'image/jpeg') return 'jpg';
  if (mime === 'image/png') return 'png';
  return 'pdf';
}

function assertStore(isStoreUnavailable: () => boolean): void {
  if (isStoreUnavailable()) {
    throw new ClinicalError('store_unavailable', STORE_DOWN);
  }
}

function hasConsultaForExpediente(
  state: MemoryInstitutionState,
  id_expediente: number,
  id_consulta: number,
): boolean {
  const maps = activeMemoryMaps(state);
  const row = maps.consultas.get(id_consulta as never);
  if (!row || typeof row !== 'object') {
    return false;
  }
  const consulta = row as { id_expediente?: number };
  return consulta.id_expediente === id_expediente;
}

export function createMemoryAttachmentsRepository(
  deps: MemoryAttachmentsDeps,
): AttachmentsRepositoryPort & { resetForTests: () => void } {
  const idempotencyIndex = new Map<string, string>();
  const orphanTemps = new Set<string>();

  function namespace(): MemoryExtensionNamespace {
    return getExtensionNamespace(activeMemoryMaps(deps.state), 'attachments');
  }

  function wrapWriteFailure(err: unknown): never {
    if (err instanceof ClinicalError) {
      throw err;
    }
    throw new ClinicalError('internal_error', 'Error interno');
  }

  function cleanupTemp(id_temp: string): void {
    const ns = namespace();
    const temps = ns.get('temps');
    temps?.delete(id_temp);
    orphanTemps.delete(id_temp);
  }

  async function replayOrStart(
    context: OperationContext,
    bytes: Uint8Array,
    id_consulta: number | undefined,
    create: (tempId: string) => Promise<DOCUMENTO_ADJUNTO>,
  ): Promise<DOCUMENTO_ADJUNTO> {
    const key = context.idempotency_key;
    if (!key) {
      throw new ClinicalError('invalid_body', INVALID);
    }
    const hash = contentHash(bytes, id_consulta);
    const idemKey = `${context.id_usuario}:${key}`;
    let tempId: string | undefined;

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

        tempId = `tmp-${idemKey}-${hash.slice(0, 12)}`;
        orphanTemps.add(tempId);
        putExtensionRow(namespace(), 'temps', tempId, {
          id_temp: tempId,
          ruta: `/tmp/genki-attachments/${tempId}`,
        } satisfies TempRow);

        const created = await create(tempId);
        const ns = namespace();
        const idemRow: IdempotencyRow = {
          key,
          id_usuario: context.id_usuario,
          payload_hash: hash,
          response: cloneDto(created),
        };
        putExtensionRow(ns, 'idempotency', idemKey, idemRow);
        idempotencyIndex.set(idemKey, idemKey);
        cleanupTemp(tempId);
        tempId = undefined;

        try {
          deps.afterWrite();
        } catch (err) {
          wrapWriteFailure(err);
        }

        return cloneDto(created);
      });
    } catch (err) {
      if (tempId) {
        try {
          cleanupTemp(tempId);
        } catch {
          orphanTemps.delete(tempId);
        }
      }
      if (err instanceof ClinicalError) {
        throw err;
      }
      wrapWriteFailure(err);
    }
  }

  const repo: AttachmentsRepositoryPort & { resetForTests: () => void } = {
    resetForTests(): void {
      idempotencyIndex.clear();
      orphanTemps.clear();
    },

    async op17(input: Op17Request, context: OperationContext): Promise<Op17Response> {
      assertStore(deps.isStoreUnavailable);
      const archivo = input.body.archivo;
      if (!(archivo instanceof Blob)) {
        throw new ClinicalError('invalid_body', INVALID);
      }
      const bytes = new Uint8Array(await archivo.arrayBuffer());
      const id_consulta = input.body.id_consulta;

      return replayOrStart(context, bytes, id_consulta, async (tempId) => {
        const idPaciente = asPacienteId(input.params.id);
        const paciente = await deps.pacientes.findById(idPaciente);
        if (!paciente) {
          cleanupTemp(tempId);
          throw new ClinicalError('not_found', NOT_FOUND);
        }
        const expediente = await deps.pacientes.findExpedienteByPaciente(idPaciente);
        if (!expediente) {
          cleanupTemp(tempId);
          throw new ClinicalError('not_found', NOT_FOUND);
        }
        if (expediente.estado === 'archivado') {
          cleanupTemp(tempId);
          throw new ClinicalError('expediente_archived', ARCHIVED);
        }
        if (id_consulta !== undefined) {
          if (!hasConsultaForExpediente(deps.state, expediente.id_expediente, id_consulta)) {
            cleanupTemp(tempId);
            throw new ClinicalError('invalid_body', INVALID);
          }
        }

        const id_documento = await deps.ids.nextInt('documento');
        const hash_sha256 = sha256Hex(bytes);
        const tipo_mime = archivo.type;
        const nombre_archivo =
          typeof (archivo as File).name === 'string' ? (archivo as File).name.trim() : 'archivo';
        const ext = extensionForMime(tipo_mime);
        const ruta = `/var/genki/attachments/${context.id_institucion}/${id_documento}/${hash_sha256.slice(0, 16)}.${ext}`;

        const row: DOCUMENTO_ADJUNTO = {
          id_documento,
          id_expediente: expediente.id_expediente,
          nombre_archivo,
          tipo_mime,
          ruta,
          hash_sha256,
          fecha_carga: context.now || deps.clock.nowIso(),
          ...(id_consulta !== undefined ? { id_consulta } : {}),
        };

        const ns = namespace();
        putExtensionRow(ns, 'documentos', id_documento, row);
        putExtensionRow(ns, 'contenido', id_documento, {
          id_documento,
          bytes,
        } satisfies ContenidoRow);
        return row;
      });
    },
  };

  return repo;
}

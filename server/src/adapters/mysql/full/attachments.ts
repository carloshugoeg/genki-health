import { createHash } from 'node:crypto';
import { asPacienteId, type InstitutionId } from '@genki/shared';
import type { DOCUMENTO_ADJUNTO } from '@genki/shared/full/attachments';
import { ClinicalError } from '../../../domain/clinical-error.js';
import type { ClockPort } from '../../../ports/clock.js';
import type { PacienteRepositoryPort } from '../../../ports/paciente-repository.js';
import type { UnitOfWorkPort } from '../../../ports/unit-of-work.js';
import type { OperationContext } from '../../../ports/full/context.js';
import type {
  AttachmentsRepositoryPort,
  Op17Request,
  Op17Response,
} from '../../../ports/full/attachments.js';
import { toMysqlDatetime } from '../mapper.js';
import { mysqlQueryResult } from './query.js';

const NOT_FOUND = 'Recurso no encontrado';
const ARCHIVED = 'Expediente archivado';
const INVALID = 'Solicitud inválida';
const MAX_BYTES = 10 * 1024 * 1024;

const MAGIC: Array<{ mime: string; test: (b: Uint8Array) => boolean }> = [
  {
    mime: 'application/pdf',
    test: (b) => b.length >= 5 && b[0] === 0x25 && b[1] === 0x50 && b[2] === 0x44 && b[3] === 0x46,
  },
  {
    mime: 'image/jpeg',
    test: (b) => b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff,
  },
  {
    mime: 'image/png',
    test: (b) =>
      b.length >= 8 &&
      b[0] === 0x89 &&
      b[1] === 0x50 &&
      b[2] === 0x4e &&
      b[3] === 0x47 &&
      b[4] === 0x0d &&
      b[5] === 0x0a &&
      b[6] === 0x1a &&
      b[7] === 0x0a,
  },
];

function detectMime(bytes: Uint8Array): string {
  const hit = MAGIC.find((row) => row.test(bytes));
  if (!hit) throw new ClinicalError('invalid_body', INVALID);
  return hit.mime;
}

function extensionForMime(mime: string): string {
  if (mime === 'image/jpeg') return 'jpg';
  if (mime === 'image/png') return 'png';
  return 'pdf';
}

export function createMysqlAttachmentsRepository(deps: {
  id_institucion: InstitutionId;
  pacientes: PacienteRepositoryPort;
  unitOfWork: UnitOfWorkPort;
  clock: ClockPort;
}): AttachmentsRepositoryPort {
  return {
    async op17(input: Op17Request, context: OperationContext): Promise<Op17Response> {
      return deps.unitOfWork.runInTransaction(async () => {
        const idPaciente = asPacienteId(input.params.id);
        const expediente = await deps.pacientes.findExpedienteByPaciente(idPaciente);
        if (!expediente) throw new ClinicalError('not_found', NOT_FOUND);
        if (expediente.estado === 'archivado') {
          throw new ClinicalError('expediente_archived', ARCHIVED);
        }
        if (!(input.body.archivo instanceof Blob)) {
          throw new ClinicalError('invalid_body', INVALID);
        }
        const bytes = new Uint8Array(Buffer.from(await input.body.archivo.arrayBuffer()));
        if (bytes.byteLength === 0 || bytes.byteLength > MAX_BYTES) {
          throw new ClinicalError('invalid_body', INVALID);
        }
        const tipo_mime = detectMime(bytes);
        if (input.body.id_consulta != null) {
          const found = await mysqlQueryResult<{ id_consulta: number }>(
            `SELECT c.id_consulta FROM consulta c
               JOIN expediente e ON e.id_expediente = c.id_expediente
              WHERE c.id_consulta = ? AND e.id_expediente = ?`,
            [input.body.id_consulta, expediente.id_expediente],
          );
          if (!found.rows[0]) throw new ClinicalError('not_found', NOT_FOUND);
        }
        const hash = createHash('sha256').update(bytes).digest('hex');
        const nombre = `doc-${hash.slice(0, 12)}.${extensionForMime(tipo_mime)}`;
        const ruta = `local://${deps.id_institucion}/${expediente.id_expediente}/${nombre}`;
        await mysqlQueryResult(
          `INSERT INTO documento_adjunto (
             id_institucion, id_expediente, id_consulta, nombre_archivo, tipo_mime,
             ruta, hash_sha256, fecha_carga, contenido
           ) VALUES (?,?,?,?,?,?,?,?,?)`,
          [
            deps.id_institucion,
            expediente.id_expediente,
            input.body.id_consulta ?? null,
            nombre,
            tipo_mime,
            ruta,
            hash,
            toMysqlDatetime(context.now || deps.clock.nowIso()),
            Buffer.from(bytes),
          ],
        );
        const idRows = await mysqlQueryResult<{ id: number }>(`SELECT LAST_INSERT_ID() AS id`);
        const id_documento = Number(idRows.rows[0]?.id);
        const out: DOCUMENTO_ADJUNTO = {
          id_documento,
          id_expediente: expediente.id_expediente,
          nombre_archivo: nombre,
          tipo_mime,
          ruta,
          hash_sha256: hash,
          fecha_carga: context.now || deps.clock.nowIso(),
          ...(input.body.id_consulta != null ? { id_consulta: input.body.id_consulta } : {}),
        };
        return out;
      });
    },
  };
}

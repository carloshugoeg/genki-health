import { createHash } from 'node:crypto';
import {
  asConsultaId,
  asPacienteId,
  type ConsultaDto,
  type ExpedienteId,
  type InstitutionId,
  type ProfesionalId,
} from '@genki/shared';
import type { DOCUMENTO_ADJUNTO } from '@genki/shared/full/attachments';
import type { ConsultaDraft, SIGNOS_VITALES } from '@genki/shared/full/consultation';
import type { FichaCompleta } from '@genki/shared/full/patient';
import type { ALERGIA, ANTECEDENTE } from '@genki/shared/full/record';
import { ClinicalError } from '../../../domain/clinical-error.js';
import type { ClockPort } from '../../../ports/clock.js';
import type { IdPort } from '../../../ports/id.js';
import type { PacienteRepositoryPort } from '../../../ports/paciente-repository.js';
import type { AttachmentsRepositoryPort } from '../../../ports/full/attachments.js';
import type { ConsultationRepositoryPort } from '../../../ports/full/consultation.js';
import type { RecordRepositoryPort } from '../../../ports/full/record.js';
import type { FirebaseUnitOfWork } from '../unit-of-work.js';

const NOT_FOUND = 'Recurso no encontrado';
const ARCHIVED = 'Expediente archivado';
const ALREADY_ARCHIVED = 'El expediente ya está archivado';
const CONFLICT = 'Conflicto de recurso';
const INVALID = 'Solicitud inválida';
const LATER = 'OP belongs to a later consultation chunk';
const MAX_BYTES = 10 * 1024 * 1024;

function normalizeSustancia(value: string): string {
  return value.trim().toUpperCase();
}

function detectMime(bytes: Uint8Array): string {
  if (bytes.length >= 5 && bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44) {
    return 'application/pdf';
  }
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8) return 'image/jpeg';
  if (bytes.length >= 8 && bytes[0] === 0x89 && bytes[1] === 0x50) return 'image/png';
  throw new ClinicalError('invalid_body', INVALID);
}

export function createFirebaseLane1Repositories(deps: {
  unitOfWork: FirebaseUnitOfWork;
  id_institucion: InstitutionId;
  pacientes: PacienteRepositoryPort;
  ids: IdPort;
  clock: ClockPort;
}): {
  record: RecordRepositoryPort;
  attachments: AttachmentsRepositoryPort;
  consultation: ConsultationRepositoryPort;
} {
  const uow = deps.unitOfWork;

  const record: RecordRepositoryPort = {
    async op12(input) {
      return uow.runInTransaction(async () => {
        const paciente = await deps.pacientes.findById(asPacienteId(input.params.id));
        if (!paciente) throw new ClinicalError('not_found', NOT_FOUND);
        const expediente = await deps.pacientes.findExpedienteByPaciente(
          asPacienteId(input.params.id),
        );
        if (!expediente) throw new ClinicalError('not_found', NOT_FOUND);
        const antecedentes = (await uow.query(
          'antecedentes',
          (row) => row.id_expediente === expediente.id_expediente,
        )) as unknown as ANTECEDENTE[];
        const alergias = (await uow.query(
          'alergias',
          (row) => row.id_expediente === expediente.id_expediente,
        )) as unknown as ALERGIA[];
        const ficha: FichaCompleta = {
          paciente,
          expediente,
          antecedentes: antecedentes
            .map((row) => ({
              id_antecedente: Number(row.id_antecedente),
              id_expediente: Number(row.id_expediente),
              tipo: String(row.tipo),
              descripcion: String(row.descripcion),
              vigente: Boolean(row.vigente),
              fecha_registro: String(row.fecha_registro),
              ...(row.fecha_inicio != null ? { fecha_inicio: String(row.fecha_inicio) } : {}),
            }))
            .sort((a, b) => a.id_antecedente - b.id_antecedente),
          alergias: alergias
            .map((row) => ({
              id_alergia: Number(row.id_alergia),
              id_expediente: Number(row.id_expediente),
              sustancia: String(row.sustancia),
              tipo: String(row.tipo),
              severidad: String(row.severidad),
              ...(row.reaccion != null ? { reaccion: String(row.reaccion) } : {}),
              ...(row.fecha_deteccion != null
                ? { fecha_deteccion: String(row.fecha_deteccion) }
                : {}),
            }))
            .sort((a, b) => a.id_alergia - b.id_alergia),
          contactos: [],
        };
        return ficha;
      });
    },
    async op15(input, context) {
      return uow.runInTransaction(async () => {
        const expediente = await deps.pacientes.findExpedienteByPaciente(
          asPacienteId(input.params.id),
        );
        if (!expediente) throw new ClinicalError('not_found', NOT_FOUND);
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
        await uow.create('antecedentes', id_antecedente, { ...row });
        return row;
      });
    },
    async op16(input) {
      return uow.runInTransaction(async () => {
        const expediente = await deps.pacientes.findExpedienteByPaciente(
          asPacienteId(input.params.id),
        );
        if (!expediente) throw new ClinicalError('not_found', NOT_FOUND);
        if (expediente.estado === 'archivado') {
          throw new ClinicalError('expediente_archived', ARCHIVED);
        }
        const norm = normalizeSustancia(input.body.sustancia);
        const existing = await uow.query(
          'alergias',
          (row) =>
            row.id_expediente === expediente.id_expediente &&
            normalizeSustancia(String(row.sustancia)) === norm,
        );
        if (existing.length > 0) throw new ClinicalError('conflict', CONFLICT);
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
        await uow.create('alergias', id_alergia, { ...row, sustancia_norm: norm });
        return row;
      });
    },
    async op18(input, context) {
      return uow.runInTransaction(async () => {
        const expediente = await deps.pacientes.findExpedienteByPaciente(
          asPacienteId(input.params.id),
        );
        if (!expediente) throw new ClinicalError('not_found', NOT_FOUND);
        if (expediente.estado === 'archivado') {
          throw new ClinicalError('already_archived', ALREADY_ARCHIVED);
        }
        const open = await uow.query(
          'consultations',
          (row) => row.id_expediente === expediente.id_expediente && row.estado === 'abierta',
        );
        if (open.length > 0) throw new ClinicalError('conflict', CONFLICT);
        return deps.pacientes.archiveExpediente({
          id_expediente: expediente.id_expediente,
          motivo_archivo: input.body.motivo_archivo,
          fecha_archivo: context.now || deps.clock.nowIso(),
          ...(input.body.observacion_archivo !== undefined
            ? { observacion_archivo: input.body.observacion_archivo }
            : {}),
        });
      });
    },
    async op19() {
      throw new ClinicalError('misconfigured', 'OP19 belongs to a later record chunk');
    },
  };

  const attachments: AttachmentsRepositoryPort = {
    async op17(input, context) {
      return uow.runInTransaction(async () => {
        const expediente = await deps.pacientes.findExpedienteByPaciente(
          asPacienteId(input.params.id),
        );
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
        const hash = createHash('sha256').update(bytes).digest('hex');
        const id_documento = await deps.ids.nextInt('documento_adjunto');
        const nombre = `doc-${hash.slice(0, 12)}.${tipo_mime === 'image/jpeg' ? 'jpg' : tipo_mime === 'image/png' ? 'png' : 'pdf'}`;
        const ruta = `local://${deps.id_institucion}/${expediente.id_expediente}/${nombre}`;
        const row: DOCUMENTO_ADJUNTO = {
          id_documento,
          id_expediente: expediente.id_expediente,
          nombre_archivo: nombre,
          tipo_mime,
          ruta,
          hash_sha256: hash,
          fecha_carga: context.now || deps.clock.nowIso(),
          ...(input.body.id_consulta != null ? { id_consulta: input.body.id_consulta } : {}),
        };
        await uow.create('documentos_adjuntos', id_documento, {
          ...row,
          contenido_b64: Buffer.from(bytes).toString('base64'),
        });
        return row;
      });
    },
  };

  const unsupported = async (): Promise<never> => {
    throw new ClinicalError('misconfigured', LATER);
  };

  const consultation: ConsultationRepositoryPort = {
    async op26(input) {
      return uow.runInTransaction(async () => {
        const expediente = await deps.pacientes.findExpedienteByPaciente(
          asPacienteId(input.params.id),
        );
        if (!expediente) throw new ClinicalError('not_found', NOT_FOUND);
        if (expediente.estado === 'archivado') {
          throw new ClinicalError('expediente_archived', ARCHIVED);
        }
        if (input.body.id_cita != null) throw new ClinicalError('invalid_body', INVALID);
        const open = await uow.query(
          'consultations',
          (row) => row.id_expediente === expediente.id_expediente && row.estado === 'abierta',
        );
        if (open.length > 0) throw new ClinicalError('conflict', CONFLICT);
        const id_consulta = await deps.ids.nextInt('consulta');
        const consulta: ConsultaDto = {
          id_consulta: asConsultaId(id_consulta),
          id_expediente: expediente.id_expediente as ExpedienteId,
          id_profesional: input.body.id_profesional as ProfesionalId,
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
        await uow.create('consultations', id_consulta, {
          ...consulta,
          diagnosticos: [],
          tratamientos: [],
          receta: null,
          detalles: [],
        });
        await uow.create('consulta_borradores', id_consulta, {
          id_consulta,
          revision: 1,
          bundle: { diagnosticos: [], tratamientos: [], receta: null },
        });
        const draft: ConsultaDraft = {
          consulta: { ...consulta, estado: 'abierta', tipo: input.body.tipo },
          revision: 1,
          diagnosticos: [],
          tratamientos: [],
          receta: null,
        };
        return draft;
      });
    },
    async op27(input, context) {
      return uow.runInTransaction(async () => {
        const consulta = await uow.read('consultations', input.params.id);
        if (!consulta) throw new ClinicalError('not_found', NOT_FOUND);
        if (consulta.estado !== 'abierta') throw new ClinicalError('conflict', CONFLICT);
        const existing = await uow.query(
          'signos_vitales',
          (row) => row.id_consulta === input.params.id,
        );
        if (existing.length > 0) throw new ClinicalError('conflict', CONFLICT);
        const id_signos = await deps.ids.nextInt('signos_vitales');
        const row: SIGNOS_VITALES = {
          id_signos,
          id_consulta: input.params.id,
          fecha_hora_toma: context.now || deps.clock.nowIso(),
          ...input.body,
        };
        await uow.create('signos_vitales', id_signos, { ...row });
        return row;
      });
    },
    op28: unsupported,
    op29: unsupported,
    op30: unsupported,
    op31: unsupported,
    op32: unsupported,
    op33: unsupported,
  };

  return { record, attachments, consultation };
}

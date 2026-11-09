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
import type { Db, Document, FindOptions, InsertOneOptions } from 'mongodb';
import { ClinicalError } from '../../../domain/clinical-error.js';
import { OPEN_CONSULTATION_BLOCKS_ARCHIVE } from '../../../domain/full/clinical-maintenance.js';
import type { ClockPort } from '../../../ports/clock.js';
import type { IdPort } from '../../../ports/id.js';
import type { PacienteRepositoryPort } from '../../../ports/paciente-repository.js';
import type { UnitOfWorkPort } from '../../../ports/unit-of-work.js';
import type { AttachmentsRepositoryPort } from '../../../ports/full/attachments.js';
import type { ConsultationRepositoryPort } from '../../../ports/full/consultation.js';
import type { RecordRepositoryPort } from '../../../ports/full/record.js';
import { createMongoClinicalMaintenance } from './clinical-maintenance.js';
import { makeDocumentId, toBsonDate, toBsonInt } from '../mapper.js';
import { activeMongoSession } from '../unit-of-work.js';

const NOT_FOUND = 'Recurso no encontrado';
const ARCHIVED = 'Expediente archivado';
const ALREADY_ARCHIVED = 'El expediente ya está archivado';
const CONFLICT = 'Conflicto de recurso';
const INVALID = 'Solicitud inválida';
const LATER = 'OP belongs to a later consultation chunk';
const MAX_BYTES = 10 * 1024 * 1024;

function sessionOpts():
  Pick<FindOptions, 'session'> | Pick<InsertOneOptions, 'session'> | Record<string, never> {
  const session = activeMongoSession();
  return session ? { session } : {};
}

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

export function createMongoLane1Repositories(deps: {
  db: Db;
  id_institucion: InstitutionId;
  pacientes: PacienteRepositoryPort;
  ids: IdPort;
  unitOfWork: UnitOfWorkPort;
  clock: ClockPort;
}): {
  record: RecordRepositoryPort;
  attachments: AttachmentsRepositoryPort;
  consultation: ConsultationRepositoryPort;
} {
  const inst = toBsonInt(deps.id_institucion);

  const record: RecordRepositoryPort = {
    async op12(input) {
      return deps.unitOfWork.runInTransaction(async () => {
        const idPaciente = asPacienteId(input.params.id);
        const paciente = await deps.pacientes.findById(idPaciente);
        if (!paciente) throw new ClinicalError('not_found', NOT_FOUND);
        const expediente = await deps.pacientes.findExpedienteByPaciente(idPaciente);
        if (!expediente) throw new ClinicalError('not_found', NOT_FOUND);
        const opts = sessionOpts();
        const antecedentes = (await deps.db
          .collection('antecedentes')
          .find({ institution_id: inst, id_expediente: toBsonInt(expediente.id_expediente) }, opts)
          .sort({ id_antecedente: 1 })
          .toArray()) as unknown as ANTECEDENTE[];
        const alergias = (await deps.db
          .collection('alergias')
          .find({ institution_id: inst, id_expediente: toBsonInt(expediente.id_expediente) }, opts)
          .sort({ id_alergia: 1 })
          .toArray()) as unknown as ALERGIA[];
        const ficha: FichaCompleta = {
          paciente,
          expediente,
          antecedentes: antecedentes.map((row) => ({
            id_antecedente: Number(row.id_antecedente),
            id_expediente: Number(row.id_expediente),
            tipo: String(row.tipo),
            descripcion: String(row.descripcion),
            vigente: Boolean(row.vigente),
            fecha_registro: String(row.fecha_registro),
            ...(row.fecha_inicio != null ? { fecha_inicio: String(row.fecha_inicio) } : {}),
          })),
          alergias: alergias.map((row) => ({
            id_alergia: Number(row.id_alergia),
            id_expediente: Number(row.id_expediente),
            sustancia: String(row.sustancia),
            tipo: String(row.tipo),
            severidad: String(row.severidad),
            ...(row.reaccion != null ? { reaccion: String(row.reaccion) } : {}),
            ...(row.fecha_deteccion != null
              ? { fecha_deteccion: String(row.fecha_deteccion) }
              : {}),
          })),
          contactos: [],
        };
        return ficha;
      });
    },
    async op15(input, context) {
      return deps.unitOfWork.runInTransaction(async () => {
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
        await deps.db.collection('antecedentes').insertOne(
          {
            _id: makeDocumentId(deps.id_institucion, id_antecedente),
            institution_id: inst,
            ...row,
            id_antecedente: toBsonInt(id_antecedente),
            id_expediente: toBsonInt(expediente.id_expediente),
          } as Document,
          sessionOpts(),
        );
        return row;
      });
    },
    async op16(input) {
      return deps.unitOfWork.runInTransaction(async () => {
        const expediente = await deps.pacientes.findExpedienteByPaciente(
          asPacienteId(input.params.id),
        );
        if (!expediente) throw new ClinicalError('not_found', NOT_FOUND);
        if (expediente.estado === 'archivado') {
          throw new ClinicalError('expediente_archived', ARCHIVED);
        }
        const norm = normalizeSustancia(input.body.sustancia);
        const existing = await deps.db.collection('alergias').findOne(
          {
            institution_id: inst,
            id_expediente: toBsonInt(expediente.id_expediente),
            sustancia_norm: norm,
          },
          sessionOpts(),
        );
        if (existing) throw new ClinicalError('conflict', CONFLICT);
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
        await deps.db.collection('alergias').insertOne(
          {
            _id: makeDocumentId(deps.id_institucion, id_alergia),
            institution_id: inst,
            ...row,
            sustancia_norm: norm,
            id_alergia: toBsonInt(id_alergia),
            id_expediente: toBsonInt(expediente.id_expediente),
          } as Document,
          sessionOpts(),
        );
        return row;
      });
    },
    async op18(input, context) {
      return deps.unitOfWork.runInTransaction(async () => {
        const expediente = await deps.pacientes.findExpedienteByPaciente(
          asPacienteId(input.params.id),
        );
        if (!expediente) throw new ClinicalError('not_found', NOT_FOUND);
        if (expediente.estado === 'archivado') {
          throw new ClinicalError('already_archived', ALREADY_ARCHIVED);
        }
        const open = await deps.db.collection('consultas').findOne(
          {
            institution_id: inst,
            id_expediente: toBsonInt(expediente.id_expediente),
            estado: 'abierta',
          },
          sessionOpts(),
        );
        if (open) throw new ClinicalError('consulta_abierta', OPEN_CONSULTATION_BLOCKS_ARCHIVE);
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
    async op19(input, context) {
      return deps.unitOfWork.runInTransaction(async () => {
        const expediente = await deps.pacientes.findExpedienteByPaciente(
          asPacienteId(input.params.id),
        );
        if (!expediente) throw new ClinicalError('not_found', NOT_FOUND);
        if (expediente.estado !== 'archivado') {
          throw new ClinicalError('conflict', CONFLICT);
        }
        const auditId = await deps.ids.nextInt('reactivacion_audit');
        await deps.db.collection('reactivacion_audit').insertOne(
          {
            _id: makeDocumentId(deps.id_institucion, auditId),
            institution_id: inst,
            id: toBsonInt(auditId),
            id_expediente: toBsonInt(expediente.id_expediente),
            id_usuario: toBsonInt(context.id_usuario),
            motivo: input.body.motivo,
            fecha_hora: toBsonDate(context.now || deps.clock.nowIso()),
            archivo_previo: {
              fecha_archivo: expediente.fecha_archivo,
              motivo_archivo: expediente.motivo_archivo,
              observacion_archivo: expediente.observacion_archivo,
            },
          } as Document,
          sessionOpts(),
        );
        return deps.pacientes.reactivateExpediente({ id_expediente: expediente.id_expediente });
      });
    },
  };

  const attachments: AttachmentsRepositoryPort = {
    async op17(input, context) {
      return deps.unitOfWork.runInTransaction(async () => {
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
        await deps.db.collection('documentos_adjuntos').insertOne(
          {
            _id: makeDocumentId(deps.id_institucion, id_documento),
            institution_id: inst,
            ...row,
            id_documento: toBsonInt(id_documento),
            id_expediente: toBsonInt(expediente.id_expediente),
            contenido_b64: Buffer.from(bytes).toString('base64'),
          } as Document,
          sessionOpts(),
        );
        return row;
      });
    },
  };

  const unsupported = async (): Promise<never> => {
    throw new ClinicalError('misconfigured', LATER);
  };

  const consultation: ConsultationRepositoryPort = {
    async op26(input) {
      return deps.unitOfWork.runInTransaction(async () => {
        const expediente = await deps.pacientes.findExpedienteByPaciente(
          asPacienteId(input.params.id),
        );
        if (!expediente) throw new ClinicalError('not_found', NOT_FOUND);
        if (expediente.estado === 'archivado') {
          throw new ClinicalError('expediente_archived', ARCHIVED);
        }
        if (input.body.id_cita != null) {
          throw new ClinicalError('invalid_body', INVALID);
        }
        const open = await deps.db.collection('consultas').findOne(
          {
            institution_id: inst,
            id_expediente: toBsonInt(expediente.id_expediente),
            estado: 'abierta',
          },
          sessionOpts(),
        );
        if (open) throw new ClinicalError('conflict', CONFLICT);
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
        await deps.db.collection('consultas').insertOne(
          {
            _id: makeDocumentId(deps.id_institucion, id_consulta),
            institution_id: inst,
            id_consulta: toBsonInt(id_consulta),
            id_expediente: toBsonInt(expediente.id_expediente),
            id_profesional: toBsonInt(input.body.id_profesional),
            id_cita: null,
            fecha_hora_inicio: toBsonDate(input.body.fecha_hora_inicio),
            fecha_hora_fin: null,
            tipo: input.body.tipo,
            motivo_consulta: input.body.motivo_consulta,
            enfermedad_actual: null,
            exploracion_fisica: null,
            plan: null,
            estado: 'abierta',
            diagnosticos: [],
            tratamientos: [],
            receta: null,
            detalles: [],
            borrador: { diagnosticos: [], tratamientos: [], receta: null },
            signos_vitales: null,
          } as Document,
          sessionOpts(),
        );
        await deps.db.collection('consulta_borradores').insertOne(
          {
            _id: makeDocumentId(deps.id_institucion, id_consulta),
            institution_id: inst,
            id_consulta: toBsonInt(id_consulta),
            revision: 1,
            bundle: { diagnosticos: [], tratamientos: [], receta: null },
          } as Document,
          sessionOpts(),
        );
        const draft: ConsultaDraft = {
          consulta: {
            ...consulta,
            estado: 'abierta',
            tipo: input.body.tipo,
          },
          revision: 1,
          diagnosticos: [],
          tratamientos: [],
          receta: null,
        };
        return draft;
      });
    },
    async op27(input, context) {
      return deps.unitOfWork.runInTransaction(async () => {
        const consulta = await deps.db
          .collection('consultas')
          .findOne(
            { institution_id: inst, id_consulta: toBsonInt(input.params.id) },
            sessionOpts(),
          );
        if (!consulta) throw new ClinicalError('not_found', NOT_FOUND);
        if (consulta.estado !== 'abierta') throw new ClinicalError('conflict', CONFLICT);
        const existing = await deps.db
          .collection('signos_vitales')
          .findOne(
            { institution_id: inst, id_consulta: toBsonInt(input.params.id) },
            sessionOpts(),
          );
        if (existing) throw new ClinicalError('conflict', CONFLICT);
        const id_signos = await deps.ids.nextInt('signos_vitales');
        const row: SIGNOS_VITALES = {
          id_signos,
          id_consulta: input.params.id,
          fecha_hora_toma: context.now || deps.clock.nowIso(),
          ...input.body,
        };
        await deps.db.collection('signos_vitales').insertOne(
          {
            _id: makeDocumentId(deps.id_institucion, id_signos),
            institution_id: inst,
            ...row,
            id_signos: toBsonInt(id_signos),
            id_consulta: toBsonInt(input.params.id),
          } as Document,
          sessionOpts(),
        );
        return row;
      });
    },
    op28: unsupported,
    op29: unsupported,
    op30: unsupported,
    op31: unsupported,
    op32: unsupported,
    op33: unsupported,
    ...createMongoClinicalMaintenance({
      db: deps.db,
      id_institucion: deps.id_institucion,
      ids: deps.ids,
    }),
  };

  return { record, attachments, consultation };
}

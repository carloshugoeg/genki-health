import { ClinicalError } from '../clinical-error.js';

export const ATTACHMENT_CLINICAL_ROLES = ['medico', 'odontologo', 'enfermeria'] as const;

export const ATTACHMENT_ALLOWED_MIMES = ['application/pdf', 'image/jpeg', 'image/png'] as const;
export type AttachmentMime = (typeof ATTACHMENT_ALLOWED_MIMES)[number];

export const ATTACHMENT_MAX_BYTES = 10 * 1024 * 1024;

export interface ValidateAttachInput {
  nombre_archivo: string;
  tipo_mime: AttachmentMime;
  bytes: Uint8Array;
  id_consulta?: number;
}

const ATTACH_KEYS = new Set(['archivo', 'id_consulta']);

const PDF_MAGIC = new TextEncoder().encode('%PDF');
const JPEG_MAGIC = new Uint8Array([0xff, 0xd8, 0xff]);
const PNG_MAGIC = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function assertNoUnknownKeys(body: Record<string, unknown>, allowed: Set<string>): void {
  for (const key of Object.keys(body)) {
    if (!allowed.has(key)) {
      throw new ClinicalError('invalid_body', 'Solicitud inválida');
    }
  }
}

function assertPositiveId(value: unknown, code: 'invalid_query' | 'invalid_body'): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 1 || value > 2_147_483_647) {
    throw new ClinicalError(code, 'Solicitud inválida');
  }
  return value;
}

function hasMagic(bytes: Uint8Array, magic: Uint8Array): boolean {
  if (bytes.length < magic.length) {
    return false;
  }
  for (let i = 0; i < magic.length; i += 1) {
    if (bytes[i] !== magic[i]) {
      return false;
    }
  }
  return true;
}

export function assertAttachmentClinicalRole(roles: readonly string[]): void {
  if (!roles.some((role) => (ATTACHMENT_CLINICAL_ROLES as readonly string[]).includes(role))) {
    throw new ClinicalError('forbidden', 'No autorizado');
  }
}

export function parseOp17Params(params: { id: number }): number {
  return assertPositiveId(params?.id, 'invalid_body');
}

export function requireIdempotencyKey(key: string | undefined): string {
  if (typeof key !== 'string') {
    throw new ClinicalError('invalid_body', 'Solicitud inválida');
  }
  const trimmed = key.trim();
  if (trimmed.length < 1 || trimmed.length > 80) {
    throw new ClinicalError('invalid_body', 'Solicitud inválida');
  }
  return trimmed;
}

export function assertMagicMatchesMime(bytes: Uint8Array, mime: AttachmentMime): void {
  const ok =
    mime === 'application/pdf'
      ? hasMagic(bytes, PDF_MAGIC)
      : mime === 'image/jpeg'
        ? hasMagic(bytes, JPEG_MAGIC)
        : hasMagic(bytes, PNG_MAGIC);
  if (!ok) {
    throw new ClinicalError('invalid_body', 'Solicitud inválida');
  }
}

export function parseAttachEnvelope(body: unknown): {
  archivo: Blob;
  id_consulta?: number;
} {
  if (!isPlainObject(body)) {
    throw new ClinicalError('invalid_body', 'Solicitud inválida');
  }
  assertNoUnknownKeys(body, ATTACH_KEYS);

  if (!('archivo' in body) || !(body.archivo instanceof Blob)) {
    throw new ClinicalError('invalid_body', 'Solicitud inválida');
  }

  const archivo = body.archivo;
  if (archivo.size < 1 || archivo.size > ATTACHMENT_MAX_BYTES) {
    throw new ClinicalError('invalid_body', 'Solicitud inválida');
  }

  const mime = archivo.type;
  if (typeof mime !== 'string' || !(ATTACHMENT_ALLOWED_MIMES as readonly string[]).includes(mime)) {
    throw new ClinicalError('invalid_body', 'Solicitud inválida');
  }

  const nombre = typeof (archivo as File).name === 'string' ? (archivo as File).name.trim() : '';
  if (
    nombre.length < 1 ||
    nombre.length > 160 ||
    nombre.includes('\u0000') ||
    nombre.includes('..')
  ) {
    throw new ClinicalError('invalid_body', 'Solicitud inválida');
  }

  let id_consulta: number | undefined;
  if ('id_consulta' in body) {
    id_consulta = assertPositiveId(body.id_consulta, 'invalid_body');
  }

  return {
    archivo,
    ...(id_consulta !== undefined ? { id_consulta } : {}),
  };
}

export function toValidatedAttachInput(
  envelope: { archivo: Blob; id_consulta?: number },
  bytes: Uint8Array,
): ValidateAttachInput {
  if (bytes.byteLength !== envelope.archivo.size) {
    throw new ClinicalError('invalid_body', 'Solicitud inválida');
  }
  const mime = envelope.archivo.type as AttachmentMime;
  assertMagicMatchesMime(bytes, mime);
  const nombre_archivo = (envelope.archivo as File).name.trim();
  return {
    nombre_archivo,
    tipo_mime: mime,
    bytes,
    ...(envelope.id_consulta !== undefined ? { id_consulta: envelope.id_consulta } : {}),
  };
}

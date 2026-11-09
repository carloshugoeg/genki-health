/**
 * Attachment rules mirrored from server/src/domain/full/attachments.ts
 * (ATTACHMENT_ALLOWED_MIMES, magic bytes, nombre_archivo 1..160 sin "..").
 *
 * Size: the domain caps files at 10 MB (ATTACHMENT_MAX_BYTES); the documentos route raises its
 * JSON body limit to fit that file once base64-encoded (DOCUMENT_BODY_LIMIT_BYTES).
 */
export const DOCUMENT_MIMES = ['application/pdf', 'image/jpeg', 'image/png'] as const;
export type DocumentMime = (typeof DOCUMENT_MIMES)[number];

export const DOCUMENT_MAX_BYTES = 10 * 1024 * 1024;

export const DOCUMENT_ACCEPT = '.pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png';

const EXTENSION_MIME: Record<string, DocumentMime> = {
  pdf: 'application/pdf',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
};

const MAGIC: Record<DocumentMime, number[]> = {
  'application/pdf': [0x25, 0x50, 0x44, 0x46],
  'image/jpeg': [0xff, 0xd8, 0xff],
  'image/png': [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a],
};

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** Resolves the MIME the server will accept, using the browser type or the extension. */
export function documentMime(name: string, browserType: string): DocumentMime | null {
  if ((DOCUMENT_MIMES as readonly string[]).includes(browserType)) {
    return browserType as DocumentMime;
  }
  const ext = name.split('.').pop()?.toLowerCase() ?? '';
  return EXTENSION_MIME[ext] ?? null;
}

/** Returns a Spanish error message, or null when the file metadata is acceptable. */
export function validateDocumentMeta(file: {
  name: string;
  size: number;
  type: string;
}): string | null {
  const name = file.name.trim();
  if (!name) return 'El archivo no tiene nombre.';
  if (name.length > 160) return 'El nombre del archivo supera 160 caracteres.';
  if (name.includes('..') || name.includes('\u0000')) {
    return 'El nombre del archivo no puede contener "..". Renómbrelo e intente de nuevo.';
  }
  if (!documentMime(name, file.type)) {
    return 'Tipo de archivo no permitido. Solo se aceptan PDF, JPEG o PNG.';
  }
  if (file.size < 1) return 'El archivo está vacío.';
  if (file.size > DOCUMENT_MAX_BYTES) {
    return `El archivo pesa ${formatBytes(file.size)}; el máximo permitido es ${formatBytes(DOCUMENT_MAX_BYTES)}.`;
  }
  return null;
}

/** Checks the leading bytes against the declared type, like the server does. */
export function matchesMagic(bytes: Uint8Array, mime: DocumentMime): boolean {
  const magic = MAGIC[mime];
  if (bytes.length < magic.length) return false;
  return magic.every((value, index) => bytes[index] === value);
}

/** Base64 without the `data:...;base64,` prefix. */
export function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

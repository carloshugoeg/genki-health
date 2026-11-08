/** Full-system DTOs for module `attachments` (F2/F3). */

export type { JsonValue, Page, PageQuery } from './schema.js';

export type { DOCUMENTO_ADJUNTO } from './schema.js';

export const ATTACHMENT_CLINICAL_ROLES = ['medico', 'odontologo', 'enfermeria'] as const;

export const ATTACHMENT_ALLOWED_MIMES = ['application/pdf', 'image/jpeg', 'image/png'] as const;
export type AttachmentMime = (typeof ATTACHMENT_ALLOWED_MIMES)[number];

export const ATTACHMENT_MAX_BYTES = 10 * 1024 * 1024;

/** Full-system DTOs for module `referral` (F2/F3). */

export type { JsonValue, Page, PageQuery } from './schema.js';

export type { ORDEN_ESTUDIO, ORDEN_ESTUDIOInput, OUTBOX_LAB } from './schema.js';

import type { ORDEN_ESTUDIOInput } from './schema.js';

export type OrdenEstudioCreate = ORDEN_ESTUDIOInput & { examenes: string[] };

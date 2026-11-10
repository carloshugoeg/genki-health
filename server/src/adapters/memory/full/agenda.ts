import type { InstitutionId } from '@genki/shared';
import type { CITA } from '@genki/shared/full/agenda';
import { ClinicalError } from '../../../domain/clinical-error.js';
import {
  assertNoOverlap,
  assertNotInPast,
  generateAvailableSlots,
  intervalEndIso,
  lockKeysForInterval,
  parseOp20Query,
  parseOp21Body,
  type BusyInterval,
} from '../../../domain/full/agenda.js';
import type {
  Op20Request,
  Op20Response,
  Op21Request,
  Op21Response,
} from '../../../ports/full/agenda.js';
import type { OperationContext } from '../../../ports/full/context.js';
import type { IdPort, UnitOfWorkPort } from '../../../ports/index.js';
import {
  getExtensionNamespace,
  putExtensionRow,
  registerExtensionNamespace,
  type MemoryExtensionNamespace,
} from '../full-state.js';
import type { MemoryInstitutionState } from '../state.js';
import { activeMemoryMaps } from '../unit-of-work.js';

const SLUG = 'agenda';
const TABLE_CITAS = 'citas';
const TABLE_LOCKS = 'agenda_locks';

export type MemoryAgendaAdapter = {
  op20(input: Op20Request, context: OperationContext): Promise<Op20Response>;
  op21(input: Op21Request, context: OperationContext): Promise<Op21Response>;
  failAfterWrite(n: number): void;
  setStoreUnavailable(value: boolean): void;
  resetTestHooks(): void;
};

export type MemoryAgendaDeps = {
  state: MemoryInstitutionState;
  ids: IdPort;
  unitOfWork: UnitOfWorkPort;
  institutionId: InstitutionId;
};

function ensureRegistered(): void {
  try {
    registerExtensionNamespace(SLUG);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (!/duplicate/i.test(message)) {
      throw err;
    }
  }
}

function namespaceOf(state: MemoryInstitutionState): MemoryExtensionNamespace {
  return getExtensionNamespace(activeMemoryMaps(state), SLUG);
}

function listCitas(ns: MemoryExtensionNamespace): CITA[] {
  const table = ns.get(TABLE_CITAS);
  if (!table) {
    return [];
  }
  return [...table.values()].map((row) => structuredClone(row as CITA));
}

function busyForProfessional(citas: readonly CITA[], id_profesional: number): BusyInterval[] {
  return citas
    .filter((row) => row.id_profesional === id_profesional)
    .map((row) => ({
      inicio: row.fecha_hora,
      fin: intervalEndIso(row.fecha_hora, row.duracion_minutos),
      estado: row.estado,
    }));
}

function lockId(institutionId: number, id_profesional: number, fecha: string): string {
  return `${institutionId}:${id_profesional}:${fecha}`;
}

export function createMemoryAgendaAdapter(deps: MemoryAgendaDeps): MemoryAgendaAdapter {
  ensureRegistered();

  let failAfter = 0;
  let writeCount = 0;
  let storeUnavailable = false;

  function assertStoreUp(): void {
    if (storeUnavailable) {
      throw new ClinicalError('store_unavailable', 'Almacén de agenda no disponible');
    }
  }

  function noteWrite(): void {
    writeCount += 1;
    if (failAfter > 0 && writeCount >= failAfter) {
      throw new ClinicalError('internal_error', 'Fallo inyectado tras escritura');
    }
  }

  function requireProfessional(id_profesional: number): void {
    const maps = activeMemoryMaps(deps.state);
    if (!maps.catalogs.profesionales.has(id_profesional)) {
      throw new ClinicalError('not_found', 'Profesional no encontrado');
    }
  }

  function requirePatient(id_paciente: number): void {
    const maps = activeMemoryMaps(deps.state);
    if (!maps.pacientes.has(id_paciente as never)) {
      throw new ClinicalError('not_found', 'Paciente no encontrado');
    }
  }

  return {
    async op20(input, _context): Promise<Op20Response> {
      assertStoreUp();
      const query = parseOp20Query(input.query as Record<string, unknown>);
      requireProfessional(query.id_profesional);
      const ns = namespaceOf(deps.state);
      const busy = busyForProfessional(listCitas(ns), query.id_profesional);
      return generateAvailableSlots(query.id_profesional, query.desde, query.hasta, busy);
    },

    async op21(input, context): Promise<Op21Response> {
      assertStoreUp();
      const body = parseOp21Body(input.body as Record<string, unknown>);
      assertNotInPast(body.fecha_hora, context.now);
      requirePatient(body.id_paciente);
      requireProfessional(body.id_profesional);

      const inicio = body.fecha_hora;
      const fin = intervalEndIso(body.fecha_hora, body.duracion_minutos);
      const ns = namespaceOf(deps.state);
      const busy = busyForProfessional(listCitas(ns), body.id_profesional);
      assertNoOverlap(inicio, fin, busy);

      for (const fecha of lockKeysForInterval(inicio, fin)) {
        const id = lockId(deps.institutionId, body.id_profesional, fecha);
        putExtensionRow(ns, TABLE_LOCKS, id, {
          id_institucion: deps.institutionId,
          id_profesional: body.id_profesional,
          fecha,
        });
        noteWrite();
      }

      const id_cita = await deps.ids.nextInt('cita');
      const row: CITA = {
        id_cita,
        id_paciente: body.id_paciente,
        id_profesional: body.id_profesional,
        id_especialidad: body.id_especialidad,
        fecha_hora: body.fecha_hora,
        duracion_minutos: body.duracion_minutos,
        motivo: body.motivo,
        estado: 'programada',
        id_usuario_registra: context.id_usuario,
        fecha_creacion: context.now,
      };
      putExtensionRow(ns, TABLE_CITAS, id_cita, row);
      noteWrite();
      return structuredClone(row);
    },

    failAfterWrite(n: number): void {
      failAfter = n;
      writeCount = 0;
    },

    setStoreUnavailable(value: boolean): void {
      storeUnavailable = value;
    },

    resetTestHooks(): void {
      failAfter = 0;
      writeCount = 0;
      storeUnavailable = false;
    },
  };
}

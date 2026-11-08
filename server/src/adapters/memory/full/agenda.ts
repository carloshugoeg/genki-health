import type { InstitutionId } from '@genki/shared';
import type { CITA } from '@genki/shared/full/agenda';
import { ClinicalError } from '../../../domain/clinical-error.js';
import {
  assertCancellableEstado,
  assertNoOverlap,
  assertNotInPast,
  assertReschedulableEstado,
  generateAvailableSlots,
  intervalEndIso,
  lockKeysForInterval,
  parseOp20Query,
  parseOp21Body,
  parseOp22Body,
  parseOp22Params,
  parseOp23Body,
  parseOp23Params,
  type BusyInterval,
} from '../../../domain/full/agenda.js';
import type {
  Op20Request,
  Op20Response,
  Op21Request,
  Op21Response,
  Op22Request,
  Op22Response,
  Op23Request,
  Op23Response,
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
  op22(input: Op22Request, context: OperationContext): Promise<Op22Response>;
  op23(input: Op23Request, context: OperationContext): Promise<Op23Response>;
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

function busyForProfessional(
  citas: readonly CITA[],
  id_profesional: number,
  excludeId?: number,
): BusyInterval[] {
  return citas
    .filter((row) => row.id_profesional === id_profesional && row.id_cita !== excludeId)
    .map((row) => ({
      inicio: row.fecha_hora,
      fin: intervalEndIso(row.fecha_hora, row.duracion_minutos),
      estado: row.estado,
    }));
}

function lockId(institutionId: number, id_profesional: number, fecha: string): string {
  return `${institutionId}:${id_profesional}:${fecha}`;
}

function requireCita(ns: MemoryExtensionNamespace, id_cita: number): CITA {
  const table = ns.get(TABLE_CITAS);
  const row = table?.get(id_cita) as CITA | undefined;
  if (!row) {
    throw new ClinicalError('not_found', 'Cita no encontrada');
  }
  return structuredClone(row);
}

function sortedUnique(keys: readonly string[]): string[] {
  return [...new Set(keys)].sort((a, b) => a.localeCompare(b));
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

  function reserveDayLocks(
    ns: MemoryExtensionNamespace,
    id_profesional: number,
    fechas: readonly string[],
  ): void {
    for (const fecha of fechas) {
      const id = lockId(deps.institutionId, id_profesional, fecha);
      putExtensionRow(ns, TABLE_LOCKS, id, {
        id_institucion: deps.institutionId,
        id_profesional,
        fecha,
      });
      noteWrite();
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

      reserveDayLocks(ns, body.id_profesional, lockKeysForInterval(inicio, fin));

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

    async op22(input, context): Promise<Op22Response> {
      assertStoreUp();
      const params = parseOp22Params(input.params as Record<string, unknown>);
      const body = parseOp22Body(input.body as Record<string, unknown>);
      assertNotInPast(body.fecha_hora, context.now);

      const ns = namespaceOf(deps.state);
      const current = requireCita(ns, params.id);
      assertReschedulableEstado(current.estado);

      const oldInicio = current.fecha_hora;
      const oldFin = intervalEndIso(current.fecha_hora, current.duracion_minutos);
      const newInicio = body.fecha_hora;
      const newFin = intervalEndIso(body.fecha_hora, body.duracion_minutos);
      const busy = busyForProfessional(listCitas(ns), current.id_profesional, current.id_cita);
      assertNoOverlap(newInicio, newFin, busy);

      const fechas = sortedUnique([
        ...lockKeysForInterval(oldInicio, oldFin),
        ...lockKeysForInterval(newInicio, newFin),
      ]);
      reserveDayLocks(ns, current.id_profesional, fechas);

      const updated: CITA = {
        ...current,
        fecha_hora: body.fecha_hora,
        duracion_minutos: body.duracion_minutos,
        estado: 'programada',
      };
      putExtensionRow(ns, TABLE_CITAS, updated.id_cita, updated);
      noteWrite();
      return structuredClone(updated);
    },

    async op23(input, _context): Promise<Op23Response> {
      assertStoreUp();
      const params = parseOp23Params(input.params as Record<string, unknown>);
      parseOp23Body(input.body as Record<string, unknown>);

      const ns = namespaceOf(deps.state);
      const current = requireCita(ns, params.id);
      assertCancellableEstado(current.estado);

      const inicio = current.fecha_hora;
      const fin = intervalEndIso(current.fecha_hora, current.duracion_minutos);
      reserveDayLocks(ns, current.id_profesional, lockKeysForInterval(inicio, fin));

      const updated: CITA = {
        ...current,
        estado: 'cancelada',
      };
      putExtensionRow(ns, TABLE_CITAS, updated.id_cita, updated);
      noteWrite();
      return structuredClone(updated);
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

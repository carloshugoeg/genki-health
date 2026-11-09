import type { CITA } from '@genki/shared/full/agenda';
import type {
  AgendaRepositoryPort,
  AgendaStore,
  Op20Request,
  Op21Request,
  Op22Request,
  Op23Request,
  Op24Request,
  Op25Request,
} from '../../ports/full/agenda.js';
import type { OperationContext } from '../../ports/full/context.js';
import {
  active,
  AGENDA_ACCESS_ROLES,
  assertFree,
  clinicalProjection,
  dayBounds,
  DEFAULT_AGENDA_HOURS,
  GUATEMALA_OFFSET_MS,
  instant,
  interval,
  invalid,
  lockKeys,
  overlaps,
  positiveId,
  validateBooking,
  type AgendaHours,
} from '../../domain/full/agenda.js';
import { assertRoles } from '../../domain/full/specialty-common.js';

export interface AgendaOptions {
  hours?: AgendaHours;
  afterWrite?: () => void | Promise<void>;
}
/** Engine-neutral operations. Stores must never supply an in-memory fallback. */
export class AgendaApplication implements AgendaRepositoryPort {
  private readonly hours: AgendaHours;
  constructor(
    private readonly store: AgendaStore,
    private readonly options: AgendaOptions = {},
  ) {
    this.hours = options.hours ?? DEFAULT_AGENDA_HOURS;
    const { startHour, endHour, slotMinutes } = this.hours;
    if (
      !Number.isInteger(startHour) ||
      !Number.isInteger(endHour) ||
      startHour < 0 ||
      endHour > 24 ||
      startHour >= endHour ||
      !Number.isInteger(slotMinutes) ||
      slotMinutes <= 0 ||
      slotMinutes > 1440
    )
      throw new Error('Horario académico inválido');
  }
  private authorize(ctx: OperationContext): void {
    assertRoles(ctx.roles, AGENDA_ACCESS_ROLES);
  }
  async op20(input: Op20Request, ctx: OperationContext) {
    this.authorize(ctx);
    const { id_profesional, desde, hasta } = input.query;
    positiveId(id_profesional, 'invalid_query');
    const start = instant(desde, 'invalid_query'),
      end = instant(hasta, 'invalid_query');
    if (end <= start || end - start > 31 * 86400000) invalid('invalid_query');
    const rows = await this.store.list(ctx.id_institucion);
    const slots = [];
    const { startHour, endHour, slotMinutes } = this.hours;
    const firstDay = Math.floor((start - GUATEMALA_OFFSET_MS) / 86400000) * 86400000;
    for (let day = firstDay; day < end - GUATEMALA_OFFSET_MS; day += 86400000) {
      if (new Date(day).getUTCDay() === 0) continue;
      for (
        let time = day + GUATEMALA_OFFSET_MS + startHour * 3600000;
        time + slotMinutes * 60000 <= day + GUATEMALA_OFFSET_MS + endHour * 3600000;
        time += slotMinutes * 60000
      ) {
        const stop = time + slotMinutes * 60000;
        if (time < start || stop > end) continue;
        if (
          !rows.some(
            (c) =>
              c.id_profesional === id_profesional &&
              active(c) &&
              overlaps([time, stop], interval(c.fecha_hora, c.duracion_minutos)),
          )
        )
          slots.push({
            id_profesional,
            inicio: new Date(time).toISOString(),
            fin: new Date(stop).toISOString(),
          });
      }
    }
    return slots;
  }
  async op21(input: Op21Request, ctx: OperationContext) {
    this.authorize(ctx);
    validateBooking(input.body);
    return this.store.transaction(
      ctx.id_institucion,
      lockKeys(ctx.id_institucion, input.body),
      async (tx) => {
        assertFree(await tx.list(), input.body);
        const cita: CITA = {
          ...input.body,
          id_cita: await tx.nextId(),
          fecha_hora: new Date(instant(input.body.fecha_hora)).toISOString(),
          estado: 'programada',
          id_usuario_registra: ctx.id_usuario,
          fecha_creacion: ctx.now,
        };
        await tx.put(cita);
        await this.options.afterWrite?.();
        return clinicalProjection(cita, ctx.roles);
      },
    );
  }
  private async change(
    id: number,
    ctx: OperationContext,
    update: (cita: CITA, rows: CITA[]) => CITA,
    target?: { fecha_hora: string; duracion_minutos: number },
  ) {
    this.authorize(ctx);
    positiveId(id);
    const prior = (await this.store.list(ctx.id_institucion)).find((c) => c.id_cita === id);
    if (!prior) invalid();
    const keys = [
      ...lockKeys(ctx.id_institucion, prior),
      ...(target ? lockKeys(ctx.id_institucion, { ...prior, ...target }) : []),
    ].sort();
    return this.store.transaction(ctx.id_institucion, keys, async (tx) => {
      const rows = await tx.list(),
        current = rows.find((c) => c.id_cita === id);
      // Another reschedule may have changed the locks required since the pre-read.
      if (
        !current ||
        current.fecha_hora !== prior.fecha_hora ||
        current.duracion_minutos !== prior.duracion_minutos
      )
        invalid();
      const result = update(current, rows);
      await tx.put(result);
      await this.options.afterWrite?.();
      return clinicalProjection(result, ctx.roles);
    });
  }
  async op22(input: Op22Request, ctx: OperationContext) {
    interval(input.body.fecha_hora, input.body.duracion_minutos);
    return this.change(
      input.params.id,
      ctx,
      (cita, rows) => {
        if (!['programada', 'confirmada'].includes(cita.estado)) invalid();
        const result = {
          ...cita,
          ...input.body,
          estado: 'programada',
          fecha_hora: new Date(instant(input.body.fecha_hora)).toISOString(),
        };
        assertFree(rows, result, cita.id_cita);
        return result;
      },
      input.body,
    );
  }
  async op23(input: Op23Request, ctx: OperationContext) {
    if (
      typeof input.body.motivo !== 'string' ||
      !input.body.motivo.trim() ||
      input.body.motivo.length > 4000
    )
      invalid('invalid_body');
    // Source CITA has no cancellation-reason field; do not overwrite clinical motivo.
    return this.change(input.params.id, ctx, (cita) => {
      if (!['programada', 'confirmada'].includes(cita.estado)) invalid();
      return { ...cita, estado: 'cancelada' };
    });
  }
  async op24(input: Op24Request, ctx: OperationContext) {
    return this.change(input.params.id, ctx, (cita) => {
      if (!['programada', 'confirmada'].includes(cita.estado)) invalid();
      return { ...cita, estado: 'confirmada' };
    });
  }
  async op25(input: Op25Request, ctx: OperationContext) {
    this.authorize(ctx);
    const [start, end] = dayBounds(input.query.fecha);
    if (input.query.id_profesional !== undefined)
      positiveId(input.query.id_profesional, 'invalid_query');
    return (await this.store.list(ctx.id_institucion))
      .filter((c) => {
        const time = instant(c.fecha_hora);
        return (
          time >= start &&
          time < end &&
          (input.query.id_profesional === undefined ||
            c.id_profesional === input.query.id_profesional)
        );
      })
      .sort((a, b) => a.fecha_hora.localeCompare(b.fecha_hora) || a.id_cita - b.id_cita)
      .map((c) => clinicalProjection(c, ctx.roles));
  }
}

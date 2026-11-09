import type { PARTICIPACION, ROL_CLINICO, Liquidacion } from '@genki/shared/full/honoraria';
import type { TARIFA_HONORARIO, TIPO_PERSONAL, PersonalDto } from '@genki/shared/full/personnel';
import type { SERVICIO_FACTURABLE } from '@genki/shared/full/charges';
import type {
  HonorariaRepositoryPort,
  Op63Request,
  Op64Request,
  Op65Request,
} from '../../ports/full/honoraria.js';
import type { EconomicStore } from '../../ports/full/charges.js';
import type { OperationContext } from '../../ports/full/context.js';
import {
  cents,
  date,
  ensure,
  money,
  next,
  roundRatio,
  scoped,
  timestamp,
} from '../../domain/full/charges.js';
import { actKey } from '../../domain/full/honoraria.js';
import { ClinicalError } from '../../domain/clinical-error.js';
import { assertRoles } from '../../domain/full/specialty-common.js';
import { generateCharge } from './charges.js';

function hasRrhhLiquidacion(ctx: OperationContext): boolean {
  if (ctx.permissions.includes('honorarios.liquidacion.todos')) return true;
  try {
    assertRoles(ctx.roles, ['rrhh']);
    return true;
  } catch (error) {
    if (error instanceof ClinicalError && error.code === 'forbidden') return false;
    throw error;
  }
}

export class HonorariaService implements HonorariaRepositoryPort {
  constructor(protected readonly store: EconomicStore) {}
  op63(input: Op63Request, ctx: OperationContext) {
    return scoped(this.store, ctx, async (tx) => {
      const b = input.body,
        key = actKey(b);
      const act = await tx.act(key.kind, key.id);
      ensure(act, 'Acto inexistente', 'reference_not_found');
      const pro = await tx.get<PersonalDto['profesional']>('professionals', b.id_profesional);
      ensure(pro?.activo, 'Profesional inexistente');
      ensure(await tx.get<ROL_CLINICO>('roles', b.codigo_rol), 'Rol inexistente');
      timestamp(b.fecha_hora_inicio);
      if (b.fecha_hora_fin) {
        timestamp(b.fecha_hora_fin);
        ensure(b.fecha_hora_fin >= b.fecha_hora_inicio, 'Horario inválido');
      }
      const rows = await tx.list<PARTICIPACION>('participations');
      ensure(
        !rows.some(
          (p) =>
            actKey(p).key === key.key &&
            p.id_profesional === b.id_profesional &&
            p.codigo_rol === b.codigo_rol,
        ),
        'Participación duplicada',
      );
      const row: PARTICIPACION = {
        ...b,
        id_participacion: await next(tx, 'participation'),
        honorario_calculado: null,
      };
      await tx.put('participations', row.id_participacion, row);
      return row;
    });
  }
  op64(input: Op64Request, ctx: OperationContext) {
    return scoped(this.store, ctx, async (tx) => {
      const key = actKey(input.body),
        act = await tx.act(key.kind, key.id);
      ensure(act, 'Acto inexistente', 'reference_not_found');
      const service = await tx.get<SERVICIO_FACTURABLE>('services', act.codigo_servicio);
      ensure(service, 'Servicio inexistente', 'reference_not_found');
      const rows = (await tx.list<PARTICIPACION>('participations')).filter(
        (p) => actKey(p).key === key.key,
      );
      for (const row of rows) {
        if (row.honorario_calculado != null) continue;
        const contract = await tx.get<PersonalDto['contrato']>('contracts', row.id_profesional);
        ensure(
          contract?.modalidad_contrato === 'honorarios',
          'Contrato sin honorarios',
          'reference_not_found',
        );
        ensure(
          (await tx.get<TIPO_PERSONAL>('personnel_types', contract.id_tipo_personal))
            ?.genera_honorario,
          'Categoría sin honorarios',
          'reference_not_found',
        );
        const role = await tx.get<ROL_CLINICO>('roles', row.codigo_rol);
        ensure(role, 'Rol inexistente', 'reference_not_found');
        const tariff = (await tx.list<TARIFA_HONORARIO>('tariffs')).find(
          (t) =>
            t.id_profesional === row.id_profesional &&
            t.codigo_servicio === act.codigo_servicio &&
            t.vigente_desde <= act.fecha_hora.slice(0, 10) &&
            (!t.vigente_hasta || act.fecha_hora.slice(0, 10) < t.vigente_hasta),
        );
        ensure(tariff, 'Tarifa inexistente', 'reference_not_found');
        const base =
          tariff.modalidad === 'fijo'
            ? cents(tariff.monto_fijo!)
            : roundRatio(cents(service.precio_unitario), cents(tariff.porcentaje!), 10000);
        row.honorario_calculado = money(roundRatio(base, cents(role.factor_honorario), 100));
        await tx.put('participations', row.id_participacion, row);
        await tx.put('honoraria_snapshots', row.id_participacion, {
          tariff,
          role,
          act,
          precio_servicio: service.precio_unitario,
          monto: row.honorario_calculado,
        });
        // Shared port supports a frozen monetary override restricted to this internal caller.
        await generateCharge(
          tx,
          {
            id_paciente: act.id_paciente,
            codigo_servicio: act.codigo_servicio,
            origen: 'honorario',
            id_participacion: row.id_participacion,
            cantidad: '1',
            clave_evento: `honorario:${row.id_participacion}`,
          },
          ctx,
          row.honorario_calculado,
        );
      }
      return rows;
    });
  }
  op65(input: Op65Request, ctx: OperationContext) {
    return scoped(this.store, ctx, async (tx) => {
      const q = input.query;
      date(q.desde);
      date(q.hasta);
      ensure(q.desde < q.hasta, 'Período inválido', 'invalid_query');
      const hr = hasRrhhLiquidacion(ctx);
      ensure(
        hr ||
          (ctx.id_profesional != null &&
            (q.id_profesional == null || q.id_profesional === ctx.id_profesional)),
        'Solo liquidación propia',
        'forbidden',
      );
      const professional = q.id_profesional ?? (hr ? null : ctx.id_profesional);
      const grouped = new Map<string, Liquidacion>();
      for (const row of await tx.list<PARTICIPACION>('participations')) {
        if (
          row.honorario_calculado == null ||
          (professional != null && professional !== row.id_profesional)
        )
          continue;
        const snapshot = await tx.get<{ act: { fecha_hora: string } }>(
          'honoraria_snapshots',
          row.id_participacion,
        );
        ensure(snapshot, 'Snapshot inexistente', 'reference_not_found');
        const day = snapshot.act.fecha_hora.slice(0, 10);
        if (day < q.desde || day >= q.hasta) continue;
        const periodo = day.slice(0, 7),
          key = `${row.id_profesional}:${periodo}`;
        const group = grouped.get(key) ?? {
          id_profesional: row.id_profesional,
          periodo,
          actos: [],
          total: '0.00',
        };
        group.actos.push({
          id_participacion: row.id_participacion,
          codigo_rol: row.codigo_rol,
          honorario: row.honorario_calculado,
        });
        group.total = money(cents(group.total) + cents(row.honorario_calculado));
        grouped.set(key, group);
      }
      return [...grouped.values()].sort(
        (a, b) => a.id_profesional - b.id_profesional || a.periodo.localeCompare(b.periodo),
      );
    });
  }
}

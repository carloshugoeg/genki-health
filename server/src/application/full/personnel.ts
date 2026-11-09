import type { PersonalDto, TARIFA_HONORARIO, TIPO_PERSONAL } from '@genki/shared/full/personnel';
import type {
  PersonnelRepositoryPort,
  Op61Request,
  Op62Request,
} from '../../ports/full/personnel.js';
import type { EconomicStore } from '../../ports/full/charges.js';
import type { OperationContext } from '../../ports/full/context.js';
import type { SERVICIO_FACTURABLE } from '@genki/shared/full/charges';
import { cents, next, scoped } from '../../domain/full/charges.js';
import { date, ensure, overlaps, positiveId, text } from '../../domain/full/personnel.js';
export class PersonnelService implements PersonnelRepositoryPort {
  constructor(protected readonly store: EconomicStore) {}
  op61(input: Op61Request, ctx: OperationContext) {
    return scoped(this.store, ctx, async (tx) => {
      const b = input.body;
      ensure(['create', 'update', 'deactivate'].includes(b.action), 'Acción inválida');
      ensure(
        b.action !== 'create' || b.id_profesional === undefined,
        'Alta no admite identificador existente',
      );
      let current: PersonalDto | null = null;
      if (b.action !== 'create') {
        positiveId(b.id_profesional);
        const professional = await tx.get<PersonalDto['profesional']>(
          'professionals',
          b.id_profesional,
        );
        const contract = await tx.get<PersonalDto['contrato']>('contracts', b.id_profesional);
        ensure(professional && contract, 'Personal inexistente');
        current = { profesional: professional, contrato: contract };
      }
      if (b.action === 'deactivate') {
        current!.profesional.activo = false;
        await tx.put('professionals', b.id_profesional!, current!.profesional);
        return current!;
      }
      const typeId = b.id_tipo_personal ?? current?.contrato.id_tipo_personal;
      positiveId(typeId);
      const type = await tx.get<TIPO_PERSONAL>('personnel_types', typeId);
      ensure(type, 'Categoría inexistente');
      const colegiado =
        b.numero_colegiado === undefined
          ? (current?.profesional.numero_colegiado ?? null)
          : b.numero_colegiado;
      if (type.requiere_colegiado) text(colegiado);
      else ensure(colegiado === null, 'La categoría no requiere colegiado');
      const all = await tx.list<PersonalDto['profesional']>('professionals');
      ensure(
        !colegiado ||
          !all.some(
            (p) =>
              p.numero_colegiado === colegiado &&
              p.id_profesional !== current?.profesional.id_profesional,
          ),
        'Colegiado duplicado',
      );
      const nombres = b.nombres ?? current?.profesional.nombres,
        apellidos = b.apellidos ?? current?.profesional.apellidos;
      text(nombres);
      text(apellidos);
      const modalidad = b.modalidad_contrato ?? current?.contrato.modalidad_contrato;
      ensure(
        modalidad && ['honorarios', 'planilla', 'externo'].includes(modalidad),
        'Contrato inválido',
      );
      const ingreso = b.fecha_ingreso ?? current?.contrato.fecha_ingreso;
      text(ingreso);
      date(ingreso);
      const id = b.action === 'create' ? await next(tx, 'professional') : b.id_profesional!;
      const profesional: PersonalDto['profesional'] = {
        id_profesional: id,
        id_institucion: ctx.id_institucion,
        nombres,
        apellidos,
        numero_colegiado: colegiado,
        id_especialidad: b.id_especialidad ?? current?.profesional.id_especialidad ?? null,
        telefono: b.telefono ?? current?.profesional.telefono ?? null,
        correo: b.correo ?? current?.profesional.correo ?? null,
        activo: current?.profesional.activo ?? true,
      };
      const contrato = {
        id_profesional: id,
        id_tipo_personal: typeId,
        modalidad_contrato: modalidad,
        fecha_ingreso: ingreso,
      };
      await tx.put('professionals', id, profesional);
      await tx.put('contracts', id, contrato);
      return { profesional, contrato };
    });
  }
  op62(input: Op62Request, ctx: OperationContext) {
    return scoped(this.store, ctx, async (tx) => {
      const b = input.body;
      const contract = await tx.get<PersonalDto['contrato']>('contracts', input.params.id);
      const professional = await tx.get<PersonalDto['profesional']>(
        'professionals',
        input.params.id,
      );
      const type =
        contract && (await tx.get<TIPO_PERSONAL>('personnel_types', contract.id_tipo_personal));
      ensure(
        professional?.activo &&
          contract?.modalidad_contrato === 'honorarios' &&
          type?.genera_honorario,
        'Personal sin honorarios',
      );
      ensure(
        (await tx.get<SERVICIO_FACTURABLE>('services', b.codigo_servicio))?.vigente,
        'Servicio inexistente',
      );
      date(b.vigente_desde);
      if (b.vigente_hasta) {
        date(b.vigente_hasta);
        ensure(b.vigente_hasta > b.vigente_desde, 'Ventana inválida');
      }
      ensure(b.modalidad === 'fijo' || b.modalidad === 'porcentaje', 'Modalidad inválida');
      if (b.modalidad === 'fijo') {
        ensure(b.monto_fijo != null && b.porcentaje == null, 'Monto fijo requerido');
        cents(b.monto_fijo);
      } else {
        ensure(b.porcentaje != null && b.monto_fijo == null, 'Porcentaje requerido');
        ensure(cents(b.porcentaje) <= 10000, 'Porcentaje fuera de rango');
      }
      const tariffs = await tx.list<TARIFA_HONORARIO>('tariffs');
      ensure(
        !tariffs.some(
          (t) =>
            t.id_profesional === input.params.id &&
            t.codigo_servicio === b.codigo_servicio &&
            overlaps(t.vigente_desde, t.vigente_hasta, b.vigente_desde, b.vigente_hasta),
        ),
        'Tarifa solapada',
      );
      const row: TARIFA_HONORARIO = {
        ...b,
        id_tarifa: await next(tx, 'tariff'),
        id_profesional: input.params.id,
      };
      await tx.put('tariffs', row.id_tarifa, row);
      return row;
    });
  }
}

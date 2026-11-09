import type { EconomicStore } from '../../../src/ports/full/charges.js';
/** Academic fixtures, insert-only; reruns never overwrite live state. */
export async function seedCharges(store: EconomicStore): Promise<void> {
  await store.transaction(async (tx) => {
    for (const [codigo_servicio, nombre, precio_unitario, tipo] of [
      ['CONSULTA', 'Consulta académica', '100.00', 'consulta'],
      ['INSUMO', 'Material académico', '10.00', 'insumo'],
    ]) {
      if (!(await tx.get('services', codigo_servicio!)))
        await tx.put('services', codigo_servicio!, {
          codigo_servicio,
          nombre,
          precio_unitario,
          tipo,
          id_institucion: store.institution,
          unidad: 'unidad',
          afecto_iva: true,
          vigente: true,
        });
    }
  });
}

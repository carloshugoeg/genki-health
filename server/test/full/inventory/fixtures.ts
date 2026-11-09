import type { EconomicStore } from '../../../src/ports/full/charges.js';
export async function seedInventory(store: EconomicStore): Promise<void> {
  await store.transaction(async (tx) => {
    if ((await tx.get('metadata', 'low_stock_threshold')) === null)
      await tx.put('metadata', 'low_stock_threshold', 5);
    if (!(await tx.get('supplies', 1)))
      await tx.put('supplies', 1, {
        id_insumo: 1,
        id_institucion: store.institution,
        codigo: 'MAT-ACADEMICO',
        nombre: 'Material académico',
        tipo: 'material',
        unidad_medida: 'unidad',
        precio_unitario: '10.00',
        codigo_servicio: 'INSUMO',
        requiere_lote: false,
        controlado: false,
        existencia_actual: 10,
      });
  });
}

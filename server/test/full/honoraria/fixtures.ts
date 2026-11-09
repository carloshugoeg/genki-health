import type { EconomicStore } from '../../../src/ports/full/charges.js';
export async function seedHonoraria(store: EconomicStore): Promise<void> {
  await store.transaction(async (tx) => {
    if (!(await tx.get('roles', 'PRINCIPAL')))
      await tx.put('roles', 'PRINCIPAL', {
        codigo_rol: 'PRINCIPAL',
        nombre: 'Principal',
        factor_honorario: '1.00',
      });
  });
}

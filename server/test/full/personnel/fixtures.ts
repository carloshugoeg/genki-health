import type { EconomicStore } from '../../../src/ports/full/charges.js';
export async function seedPersonnel(store: EconomicStore): Promise<void> {
  await store.transaction(async (tx) => {
    if (!(await tx.get('personnel_types', 1)))
      await tx.put('personnel_types', 1, {
        id_tipo_personal: 1,
        nombre: 'Profesional académico',
        requiere_colegiado: true,
        genera_honorario: true,
      });
    if (!(await tx.get('personnel_types', 2)))
      await tx.put('personnel_types', 2, {
        id_tipo_personal: 2,
        nombre: 'Apoyo académico',
        requiere_colegiado: false,
        genera_honorario: false,
      });
  });
}

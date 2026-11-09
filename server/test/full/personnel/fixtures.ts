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
    // Inventario OP66 looks up lane_a professionals by JWT id_profesional (demo uses 1).
    if (!(await tx.get('professionals', 1))) {
      await tx.put('professionals', 1, {
        id_profesional: 1,
        id_institucion: store.institution,
        nombres: 'Profesional',
        apellidos: `Simulado ${store.institution}`,
        numero_colegiado: `DEMO-${store.institution}-1`,
        id_especialidad: 1,
        telefono: null,
        correo: null,
        activo: true,
      });
    }
    if (!(await tx.get('contracts', 1))) {
      await tx.put('contracts', 1, {
        id_profesional: 1,
        id_tipo_personal: 1,
        modalidad_contrato: 'honorarios',
        fecha_ingreso: '2026-01-01',
      });
    }
    const professionalCounter = (await tx.get<number>('counters', 'professional')) ?? 0;
    if (professionalCounter < 1) await tx.put('counters', 'professional', 1);
  });
}

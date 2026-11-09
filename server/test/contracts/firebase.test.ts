import { clinicalContract } from './clinical.contract.js';
import { makeFirebaseClinicalHarness } from './firebase-harness.js';

clinicalContract('firebase', makeFirebaseClinicalHarness);

import { expect, it } from 'vitest';
import { baseRegisterInput, closeBundleFor } from './fixtures.js';

it('firestore_bounded_bundle_and_ordered_detached_history', async () => {
  const h = await makeFirebaseClinicalHarness();
  try {
    await h.reset();
    const patient = await h.context.pacientes.createWithExpediente(baseRegisterInput());
    const bundle = await closeBundleFor(h.context, patient.expediente.id_expediente, {
      withReceta: false,
    });
    const before = await h.counts();
    const oversized = structuredClone(bundle);
    oversized.consulta.motivo_consulta = 'é'.repeat(256 * 1024);
    await expect(h.context.consultas.closeConsulta(oversized)).rejects.toMatchObject({
      code: 'invalid_bundle',
    });
    expect(await h.counts()).toEqual(before);
    const first = await h.context.consultas.closeConsulta(bundle);
    const second = await h.context.consultas.closeConsulta(bundle);
    const history = await h.context.consultas.listByExpediente(patient.expediente.id_expediente);
    expect(history.map((row) => row.consulta.id_consulta)).toEqual([
      second.consulta.id_consulta,
      first.consulta.id_consulta,
    ]);
    expect(Object.keys(history[0]!).sort()).toEqual([
      'consulta',
      'detalles',
      'diagnosticos',
      'receta',
      'tratamientos',
    ]);
    history[0]!.diagnosticos[0]!.descripcion = 'Mutación';
    const reread = await h.context.consultas.listByExpediente(patient.expediente.id_expediente);
    expect(reread[0]!.diagnosticos[0]!.descripcion).toBe(second.diagnosticos[0]!.descripcion);
    expect(await h.context.consultas.findById(first.consulta.id_consulta)).toEqual(first.consulta);
  } finally {
    await h.close();
  }
});

export type SeedHistoryPlan = 'keep' | 'create' | 'reject';

type SeedHistoryRow = {
  consulta: { motivo_consulta: string; fecha_hora_inicio: string };
};

/**
 * The seed never writes history for 102; 101 and 103 are satisfied by one closed seed consult,
 * even if other rows exist. Consultations recorded through the app on 102 during a demo are
 * clinical rows (never deleted), so they are preserved and must not block a re-run; only a
 * seed-stamped row on 102 is a fixture conflict.
 */
export function seedHistoryPlan(
  patientId: number,
  history: readonly SeedHistoryRow[],
  banner: string,
  seedTime: string,
): SeedHistoryPlan {
  const matched = history.some(
    (bundle) =>
      bundle.consulta.motivo_consulta === banner && bundle.consulta.fecha_hora_inicio === seedTime,
  );
  if (patientId === 102) return matched ? 'reject' : 'keep';
  return matched ? 'keep' : 'create';
}

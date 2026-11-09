export type SeedHistoryPlan = 'keep' | 'create' | 'reject';

type SeedHistoryRow = {
  consulta: { motivo_consulta: string; fecha_hora_inicio: string };
};

/** 102 stays empty. 101 and 103 are satisfied by one closed seed consult, even if other rows exist. */
export function seedHistoryPlan(
  patientId: number,
  history: readonly SeedHistoryRow[],
  banner: string,
  seedTime: string,
): SeedHistoryPlan {
  if (patientId === 102) return history.length === 0 ? 'keep' : 'reject';
  const matched = history.some(
    (bundle) =>
      bundle.consulta.motivo_consulta === banner && bundle.consulta.fecha_hora_inicio === seedTime,
  );
  return matched ? 'keep' : 'create';
}

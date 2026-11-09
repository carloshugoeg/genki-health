import { INSTITUTION_ENGINE_ASSIGNMENTS, type InstitutionKind } from '@genki/shared';

/** Presentational metadata for each institution: engine label, short mark and number. */
export const INSTITUTION_META: Record<
  InstitutionKind,
  { engine: string; mark: string; numero: number }
> = {
  hospital_general: { engine: 'PostgreSQL', mark: 'PG', numero: 1 },
  centro_pediatrico: { engine: 'MySQL', mark: 'MY', numero: 2 },
  laboratorio_clinico: { engine: 'MongoDB', mark: 'MG', numero: 3 },
  clinica_odontologica: { engine: 'Firestore', mark: 'FS', numero: 4 },
};

export function institutionKindByName(nombre: string): InstitutionKind | undefined {
  return INSTITUTION_ENGINE_ASSIGNMENTS.find((i) => i.nombre === nombre)?.kind;
}

/** Square tile with the engine abbreviation, tinted with the institution accent. */
export function InstitutionMark({
  kind,
  size = 'md',
}: {
  kind: InstitutionKind | undefined;
  size?: 'sm' | 'md' | 'lg';
}) {
  const meta = kind ? INSTITUTION_META[kind] : undefined;
  return (
    <span className={`inst-mark inst-mark--${size}`} data-institution={kind} aria-hidden="true">
      {meta?.mark ?? 'GH'}
    </span>
  );
}

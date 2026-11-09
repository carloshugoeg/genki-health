import { ensure, positiveId } from './charges.js';
export function actKey(ref: { id_consulta?: number | null; id_procedimiento?: number | null }): {
  kind: 'consulta' | 'procedimiento';
  id: number;
  key: string;
} {
  ensure(
    (ref.id_consulta != null) !== (ref.id_procedimiento != null),
    'Exactamente un acto requerido',
  );
  const kind = ref.id_consulta != null ? 'consulta' : 'procedimiento';
  const id = (ref.id_consulta ?? ref.id_procedimiento)!;
  positiveId(id);
  return { kind, id, key: `${kind}:${id}` };
}

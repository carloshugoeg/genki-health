import { useEffect, useRef, useState, type FormEvent } from 'react';
import {
  EntitySelect,
  entityLabel,
  loadEntityDirectory,
  type EntityKind,
} from '../../components/EntitySelect';
export type Field = {
  name: string;
  label: string;
  type?: string;
  optional?: boolean;
  nullable?: boolean;
  options?: string[];
  entity?: EntityKind;
};
export type Operation = {
  title: string;
  method: 'GET' | 'POST';
  path: string;
  fields: Field[];
  confirm?: string;
};
export type EconomicClient = (
  path: string,
  init: { method: string; headers: Record<string, string>; body?: string },
) => Promise<unknown>;
function labeled(key: string, item: unknown): unknown {
  if (typeof item !== 'number') return item;
  if (key === 'id_paciente' || key === 'patient') return entityLabel('paciente', item);
  if (key.includes('id_profesional')) return entityLabel('profesional', item);
  return item;
}
function Result({ value }: { value: unknown }) {
  if (value == null) return <span>—</span>;
  if (typeof value !== 'object') return <span>{String(value)}</span>;
  if (Array.isArray(value))
    return (
      <ol>
        {value.map((item, i) => (
          <li key={i}>
            <Result value={item} />
          </li>
        ))}
      </ol>
    );
  return (
    <dl>
      {Object.entries(value).map(([key, item]) => (
        <div key={key}>
          <dt>{key.replaceAll('_', ' ')}</dt>
          <dd>
            <Result value={labeled(key, item)} />
          </dd>
        </div>
      ))}
    </dl>
  );
}
function entityKind(field: Field): EntityKind | undefined {
  if (field.entity) return field.entity;
  if (field.type !== 'number') return undefined;
  if (!/id_paciente|id_profesional|consumo\.id_profesional|patient/.test(field.name))
    return undefined;
  return /id_profesional/.test(field.name) ? 'profesional' : 'paciente';
}
function EntityField({
  field,
  kind,
  disabled,
}: {
  field: Field;
  kind: EntityKind;
  disabled: boolean;
}) {
  const [value, setValue] = useState<number | ''>('');
  const allowsEmpty = Boolean(field.optional || field.nullable);
  return (
    <label>
      {field.label}{' '}
      <EntitySelect
        kind={kind}
        name={field.name}
        value={value}
        onChange={setValue}
        required={!allowsEmpty}
        optional={allowsEmpty}
        disabled={disabled}
      />
    </label>
  );
}
/** The host provides its existing authenticated client; this slice owns no identity state. */
export function EconomicPage({
  title,
  operations,
  client,
}: {
  title: string;
  operations: Operation[];
  client: EconomicClient;
}) {
  const [selected, setSelected] = useState(0),
    [busy, setBusy] = useState(false),
    [result, setResult] = useState<unknown>(),
    [error, setError] = useState(''),
    [, setNamesReady] = useState(false);
  const command = useRef<{ payload: string; key: string } | null>(null),
    op = operations[selected]!;
  useEffect(() => {
    void loadEntityDirectory()
      .then(() => setNamesReady(true))
      .catch(() => undefined);
  }, []);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget),
      body: Record<string, unknown> = {};
    let path = op.path;
    try {
      for (const field of op.fields) {
        const raw = data.get(field.name);
        if ((raw === null || raw === '') && field.optional && !field.nullable) continue;
        let value: unknown = field.nullable && (raw === null || raw === '') ? null : raw;
        if (field.type === 'number' && value !== null) value = Number(raw);
        if (field.type === 'ids')
          value = String(raw)
            .split(',')
            .map((v) => Number(v.trim()));
        if (field.type === 'checkbox') value = raw === 'on';
        if (field.type === 'datetime-local' && raw) value = new Date(String(raw)).toISOString();
        if (field.name === 'id' && path.includes(':id')) {
          path = path.replace(':id', encodeURIComponent(String(value)));
          continue;
        }
        const parts = field.name.split('.');
        if (parts.length === 2) {
          const parent = parts[0]!,
            key = parts[1]!;
          body[parent] ??= {};
          (body[parent] as Record<string, unknown>)[key] = value;
        } else body[field.name] = value;
      }
      if (op.confirm && !window.confirm(op.confirm)) return;
      const payload = JSON.stringify({ path, body });
      if (command.current?.payload !== payload)
        command.current = { payload, key: crypto.randomUUID() };
      setBusy(true);
      setError('');
      if (op.method === 'GET') {
        const query = new URLSearchParams();
        for (const [key, value] of Object.entries(body)) query.set(key, String(value));
        const suffix = query.toString();
        setResult(
          await client(path + (suffix ? '?' + suffix : ''), { method: 'GET', headers: {} }),
        );
      } else
        setResult(
          await client(path, {
            method: 'POST',
            headers: {
              'content-type': 'application/json',
              'idempotency-key': command.current!.key,
            },
            body: JSON.stringify(body),
          }),
        );
      command.current = null;
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : 'No se pudo completar la operación. Puede reintentar.',
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <section aria-label={title}>
      <h1>{title}</h1>
      <label>
        Operación{' '}
        <select
          value={selected}
          disabled={busy}
          onChange={(e) => {
            setSelected(Number(e.target.value));
            setResult(undefined);
            setError('');
            command.current = null;
          }}
        >
          {operations.map((item, i) => (
            <option key={item.title} value={i}>
              {item.title}
            </option>
          ))}
        </select>
      </label>
      <form key={selected} onSubmit={submit}>
        {op.fields.map((field) => {
          const kind = entityKind(field);
          if (kind) {
            return (
              <p key={field.name}>
                <EntityField field={field} kind={kind} disabled={busy} />
              </p>
            );
          }
          return (
            <p key={field.name}>
              <label>
                {field.label}{' '}
                {field.options ? (
                  <select name={field.name} required={!field.optional}>
                    {field.optional && <option value="">Sin especificar</option>}
                    {field.options.map((v) => (
                      <option key={v}>{v}</option>
                    ))}
                  </select>
                ) : (
                  <input
                    name={field.name}
                    required={!field.optional && field.type !== 'checkbox'}
                    type={
                      ['number', 'date', 'datetime-local', 'checkbox', 'password'].includes(
                        field.type ?? '',
                      )
                        ? field.type
                        : 'text'
                    }
                    min={field.type === 'number' ? 1 : undefined}
                    step={field.type === 'number' ? 1 : undefined}
                    inputMode={field.type === 'decimal' ? 'decimal' : undefined}
                  />
                )}
              </label>
            </p>
          );
        })}
        <button disabled={busy} type="submit">
          {busy ? 'Procesando…' : op.method === 'GET' ? 'Consultar' : 'Guardar'}
        </button>
      </form>
      {error && <p role="alert">{error}</p>}
      <div aria-live="polite">{result !== undefined && <Result value={result} />}</div>
    </section>
  );
}

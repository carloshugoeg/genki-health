import { useEffect, useState } from 'react';
import type { CatalogosDto, PacienteDto, PacientePage } from '@genki/shared';
import { api } from '../api';

export type EntityKind = 'paciente' | 'profesional';

export type EntityRef = {
  id: number;
  label: string;
};

const labels: Record<EntityKind, Map<number, string>> = {
  paciente: new Map(),
  profesional: new Map(),
};

let directory: Promise<void> | null = null;
let professionals: Promise<EntityRef[]> | null = null;

export function formatEntityLabel(nombres: string, apellidos: string, id: number): string {
  const name = `${nombres} ${apellidos}`.replace(/\s+/g, ' ').trim();
  return `${name} (#${id})`;
}

export function pacienteLabel(
  paciente: Pick<
    PacienteDto,
    'id_paciente' | 'primer_nombre' | 'segundo_nombre' | 'primer_apellido' | 'segundo_apellido'
  >,
): string {
  return formatEntityLabel(
    [paciente.primer_nombre, paciente.segundo_nombre].filter(Boolean).join(' '),
    [paciente.primer_apellido, paciente.segundo_apellido].filter(Boolean).join(' '),
    Number(paciente.id_paciente),
  );
}

export function rememberEntity(
  kind: EntityKind,
  id: number,
  nombres: string,
  apellidos: string,
): void {
  labels[kind].set(id, formatEntityLabel(nombres, apellidos, id));
}

export function entityLabel(kind: EntityKind, id: number): string {
  return (
    labels[kind].get(id) ?? (kind === 'paciente' ? `Paciente (#${id})` : `Profesional (#${id})`)
  );
}

async function fetchDirectory(): Promise<void> {
  const [catalogs, patients] = await Promise.all([
    api<CatalogosDto>('/api/catalogos'),
    api<PacientePage>('/api/pacientes?q=&estado=todos&page=1&page_size=50'),
  ]);
  for (const row of catalogs.profesionales) {
    rememberEntity('profesional', Number(row.id_profesional), row.nombres, row.apellidos);
  }
  for (const row of patients.items) rememberEntityFromPaciente(row.paciente);
}

function rememberEntityFromPaciente(paciente: PacienteDto): void {
  rememberEntity(
    'paciente',
    Number(paciente.id_paciente),
    [paciente.primer_nombre, paciente.segundo_nombre].filter(Boolean).join(' '),
    [paciente.primer_apellido, paciente.segundo_apellido].filter(Boolean).join(' '),
  );
}

export function loadEntityDirectory(): Promise<void> {
  if (!directory) {
    directory = fetchDirectory().catch((error: unknown) => {
      directory = null;
      throw error;
    });
  }
  return directory;
}

function professionalOptions(): Promise<EntityRef[]> {
  professionals ??= api<CatalogosDto>('/api/catalogos')
    .then((catalogs) =>
      catalogs.profesionales.map((row) => {
        rememberEntity('profesional', Number(row.id_profesional), row.nombres, row.apellidos);
        return {
          id: Number(row.id_profesional),
          label: formatEntityLabel(row.nombres, row.apellidos, Number(row.id_profesional)),
        };
      }),
    )
    .catch((error: unknown) => {
      professionals = null;
      throw error;
    });
  return professionals;
}

async function loadOptions(kind: EntityKind, filter: string): Promise<EntityRef[]> {
  if (kind === 'profesional') {
    const needle = filter.trim().toLowerCase();
    const rows = await professionalOptions();
    return rows.filter((row) => !needle || row.label.toLowerCase().includes(needle));
  }
  const query = new URLSearchParams({
    q: filter.trim(),
    estado: 'activo',
    page: '1',
    page_size: '50',
  });
  const page = await api<PacientePage>(`/api/pacientes?${query}`);
  return page.items.map((row) => {
    rememberEntityFromPaciente(row.paciente);
    return { id: Number(row.paciente.id_paciente), label: pacienteLabel(row.paciente) };
  });
}

export function EntitySelect({
  kind,
  name,
  value,
  onChange,
  required = false,
  disabled = false,
  optional = false,
}: {
  kind: EntityKind;
  name: string;
  value: number | '';
  onChange: (value: number | '') => void;
  required?: boolean;
  disabled?: boolean;
  optional?: boolean;
}) {
  const [filter, setFilter] = useState('');
  const [options, setOptions] = useState<EntityRef[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let active = true;
    const handle = setTimeout(
      () => {
        setLoading(true);
        setError('');
        void loadOptions(kind, filter)
          .then((rows) => {
            if (active) setOptions(rows);
          })
          .catch(() => {
            if (active) setError('No se pudo cargar la lista.');
          })
          .finally(() => {
            if (active) setLoading(false);
          });
      },
      kind === 'paciente' ? 200 : 0,
    );
    return () => {
      active = false;
      clearTimeout(handle);
    };
  }, [kind, filter]);

  const shown = [...options];
  if (value !== '' && !shown.some((row) => row.id === value)) {
    shown.unshift({ id: value, label: entityLabel(kind, value) });
  }

  return (
    <span className="entity-select">
      <input
        type="search"
        value={filter}
        disabled={disabled}
        placeholder="Filtrar"
        aria-label={kind === 'paciente' ? 'Buscar paciente' : 'Buscar profesional'}
        onKeyDown={(event) => {
          if (event.key === 'Enter') event.preventDefault();
        }}
        onChange={(event) => setFilter(event.target.value)}
      />
      <select
        name={name}
        required={required && !optional}
        disabled={disabled}
        value={value === '' ? '' : String(value)}
        onChange={(event) => onChange(event.target.value === '' ? '' : Number(event.target.value))}
      >
        <option value="">{optional ? 'Sin especificar' : 'Seleccione'}</option>
        {shown.map((row) => (
          <option key={row.id} value={row.id}>
            {row.label}
          </option>
        ))}
      </select>
      {loading && <span className="muted">Cargando…</span>}
      {error && (
        <span className="error" role="alert">
          {error}
        </span>
      )}
    </span>
  );
}

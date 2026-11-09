export type DiagnosticoRef = {
  id_diagnostico: number;
  id_consulta: number;
  codigo_cie10: string | null;
  descripcion: string;
  es_principal: boolean;
};

export function idempotencyKey(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2, 10)}`;
}

export function diagnosticoLabel(d: DiagnosticoRef): string {
  const code = d.codigo_cie10 ? d.codigo_cie10 : 'Sin CIE-10';
  const text = d.descripcion.length > 60 ? `${d.descripcion.slice(0, 57)}…` : d.descripcion;
  return `${code} · ${text} (consulta ${d.id_consulta}${d.es_principal ? ', principal' : ''})`;
}

/** Value for <input type="datetime-local"> in the browser's local time. */
export function localDateTimeValue(date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(
    date.getHours(),
  )}:${pad(date.getMinutes())}`;
}

/** datetime-local value → ISO-8601 UTC ending in Z, or null if empty/invalid. */
export function toIsoZ(value: string): string | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

export function readLocal<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

export function writeLocal(key: string, value: unknown): void {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Sin almacenamiento del navegador: el valor vive solo en memoria.
  }
}

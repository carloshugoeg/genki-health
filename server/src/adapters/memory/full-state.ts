/** Per-module namespace: table name -> id -> row. */
export type MemoryExtensionNamespace = Map<string, Map<string | number, unknown>>;

export interface MemoryExtensionHost {
  extensions: Map<string, MemoryExtensionNamespace>;
}

const registered = new Set<string>();

export function resetExtensionRegistryForTests(): void {
  registered.clear();
}

export function createEmptyExtensionMaps(): Map<string, MemoryExtensionNamespace> {
  const extensions = new Map<string, MemoryExtensionNamespace>();
  for (const slug of registered) {
    extensions.set(slug, new Map());
  }
  return extensions;
}

function cloneNamespace(source: MemoryExtensionNamespace): MemoryExtensionNamespace {
  const next: MemoryExtensionNamespace = new Map();
  for (const [table, rows] of source.entries()) {
    const clonedRows = new Map<string | number, unknown>();
    for (const [id, row] of rows.entries()) {
      clonedRows.set(id, structuredClone(row));
    }
    next.set(table, clonedRows);
  }
  return next;
}

export function cloneExtensionMaps(
  source: Map<string, MemoryExtensionNamespace>,
): Map<string, MemoryExtensionNamespace> {
  const next = new Map<string, MemoryExtensionNamespace>();
  for (const [slug, namespace] of source.entries()) {
    next.set(slug, cloneNamespace(namespace));
  }
  for (const slug of registered) {
    if (!next.has(slug)) {
      next.set(slug, new Map());
    }
  }
  return next;
}

/** Register-once extension factory. Duplicate slug fails startup. */
export function registerExtensionNamespace(slug: string): void {
  if (registered.has(slug)) {
    throw new Error(`duplicate extension namespace: ${slug}`);
  }
  registered.add(slug);
}

export function ensureMemoryExtensions(maps: MemoryExtensionHost): void {
  if (!(maps.extensions instanceof Map)) {
    maps.extensions = createEmptyExtensionMaps();
    return;
  }
  for (const slug of registered) {
    if (!maps.extensions.has(slug)) {
      maps.extensions.set(slug, new Map());
    }
  }
}

export function getExtensionNamespace(
  maps: MemoryExtensionHost,
  slug: string,
): MemoryExtensionNamespace {
  ensureMemoryExtensions(maps);
  let namespace = maps.extensions.get(slug);
  if (!namespace) {
    namespace = new Map();
    maps.extensions.set(slug, namespace);
  }
  return namespace;
}

export function putExtensionRow(
  namespace: MemoryExtensionNamespace,
  table: string,
  id: string | number,
  row: unknown,
): void {
  let rows = namespace.get(table);
  if (!rows) {
    rows = new Map();
    namespace.set(table, rows);
  }
  rows.set(id, structuredClone(row));
}

/** Memory adapter for charges extension namespace (OP-68/69). */

import { createHash } from 'node:crypto';
import type { CARGO, COMANDO_IDEMPOTENTE, SERVICIO_FACTURABLE } from '@genki/shared/full/charges';
import { ClinicalError } from '../../../domain/clinical-error.js';
import type { ChargesPersistence } from '../../../application/full/charges.js';
import type { MemoryInstitutionState } from '../state.js';
import { activeMemoryMaps } from '../unit-of-work.js';
import {
  getExtensionNamespace,
  putExtensionRow,
  type MemoryExtensionNamespace,
} from '../full-state.js';

const SLUG = 'charges';
const TABLE_SERVICIOS = 'servicios_facturables';
const TABLE_CARGOS = 'cargos';
const TABLE_COMANDOS = 'comandos_idempotentes';
const TABLE_CLAVE = 'cargo_clave_evento';

export type CargoStored = CARGO & {
  clave_evento: string;
  id_institucion: number;
};

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(',')}]`;
  }
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${stableStringify(obj[k])}`).join(',')}}`;
}

export function hashChargesSnapshot(rows: unknown[]): string {
  return createHash('sha256').update(stableStringify(rows)).digest('hex');
}

export interface MemoryChargesOptions {
  afterWrite?: () => void;
}

export class MemoryChargesStore implements ChargesPersistence {
  private unavailable = false;
  private writes = 0;
  private failAfter: number | null = null;

  constructor(
    private readonly state: MemoryInstitutionState,
    private readonly options: MemoryChargesOptions = {},
  ) {}

  setUnavailable(value: boolean): void {
    this.unavailable = value;
  }

  isUnavailable(): boolean {
    return this.unavailable;
  }

  failAfterWrite(n: number): void {
    this.failAfter = n;
    this.writes = 0;
  }

  clearFailAfterWrite(): void {
    this.failAfter = null;
    this.writes = 0;
  }

  private ns(): MemoryExtensionNamespace {
    return getExtensionNamespace(activeMemoryMaps(this.state), SLUG);
  }

  private noteWrite(): void {
    this.writes += 1;
    this.options.afterWrite?.();
    if (this.failAfter !== null && this.writes >= this.failAfter) {
      this.failAfter = null;
      throw new ClinicalError('internal_error', 'fallo inyectado a mitad de escritura');
    }
  }

  findServicio(idInstitucion: number, codigo: string): SERVICIO_FACTURABLE | null {
    const rows = this.ns().get(TABLE_SERVICIOS);
    if (!rows) return null;
    for (const row of rows.values()) {
      const s = row as SERVICIO_FACTURABLE;
      if (s.id_institucion === idInstitucion && s.codigo_servicio === codigo) {
        return structuredClone(s);
      }
    }
    return null;
  }

  seedServicio(servicio: SERVICIO_FACTURABLE): void {
    const key = `${servicio.id_institucion}:${servicio.codigo_servicio}`;
    putExtensionRow(this.ns(), TABLE_SERVICIOS, key, servicio);
  }

  findComando(idInstitucion: number, clave: string): COMANDO_IDEMPOTENTE | null {
    const rows = this.ns().get(TABLE_COMANDOS);
    const row = rows?.get(`${idInstitucion}:${clave}`);
    return row ? structuredClone(row as COMANDO_IDEMPOTENTE) : null;
  }

  findCargoByClaveEvento(idInstitucion: number, claveEvento: string): CargoStored | null {
    const rows = this.ns().get(TABLE_CLAVE);
    const id = rows?.get(`${idInstitucion}:${claveEvento}`);
    if (typeof id !== 'number') return null;
    const cargo = this.ns().get(TABLE_CARGOS)?.get(id);
    return cargo ? structuredClone(cargo as CargoStored) : null;
  }

  insertCargo(idInstitucion: number, claveEvento: string, cargo: CARGO): void {
    const stored: CargoStored = {
      ...cargo,
      clave_evento: claveEvento,
      id_institucion: idInstitucion,
    };
    putExtensionRow(this.ns(), TABLE_CARGOS, cargo.id_cargo, stored);
    this.noteWrite();
    putExtensionRow(this.ns(), TABLE_CLAVE, `${idInstitucion}:${claveEvento}`, cargo.id_cargo);
    this.noteWrite();
  }

  insertComando(comando: COMANDO_IDEMPOTENTE): void {
    putExtensionRow(
      this.ns(),
      TABLE_COMANDOS,
      `${comando.id_institucion}:${comando.clave}`,
      comando,
    );
    this.noteWrite();
  }

  listCargosByExpediente(idExpediente: number): CARGO[] {
    const rows = this.ns().get(TABLE_CARGOS);
    if (!rows) return [];
    const out: CARGO[] = [];
    for (const row of rows.values()) {
      const c = row as CargoStored;
      if (c.id_expediente === idExpediente) {
        out.push(structuredClone(c));
      }
    }
    return out;
  }

  counts(): Record<string, number> {
    const ns = this.ns();
    return {
      cargos: ns.get(TABLE_CARGOS)?.size ?? 0,
      servicios_facturables: ns.get(TABLE_SERVICIOS)?.size ?? 0,
      comandos_idempotentes: ns.get(TABLE_COMANDOS)?.size ?? 0,
    };
  }

  snapshotRows(): unknown[] {
    const ns = this.ns();
    const collect = (table: string): unknown[] => {
      const rows = ns.get(table);
      if (!rows) return [];
      return [...rows.entries()]
        .sort(([a], [b]) => String(a).localeCompare(String(b)))
        .map(([id, row]) => ({ id, row }));
    };
    return [
      { table: TABLE_SERVICIOS, rows: collect(TABLE_SERVICIOS) },
      { table: TABLE_CARGOS, rows: collect(TABLE_CARGOS) },
      { table: TABLE_COMANDOS, rows: collect(TABLE_COMANDOS) },
      { table: TABLE_CLAVE, rows: collect(TABLE_CLAVE) },
    ];
  }
}

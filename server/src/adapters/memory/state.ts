import type { ExpedienteDto, PacienteDto, PacienteId } from '@genki/shared';

export interface MemoryMaps {
  pacientes: Map<PacienteId, PacienteDto>;
  expedientes: Map<PacienteId, ExpedienteDto>;
  responsables: Map<number, unknown>;
  consultas: Map<number, unknown>;
  diagnosticos: Map<number, unknown>;
  tratamientos: Map<number, unknown>;
  recetas: Map<number, unknown>;
  detalles: Map<number, unknown>;
  counters: Map<string, number>;
  catalogs: {
    municipios: Map<number, unknown>;
    profesionales: Map<number, unknown>;
    cie10: Map<number, unknown>;
    medicamentos: Map<number, unknown>;
  };
}

export function createEmptyMemoryMaps(): MemoryMaps {
  return {
    pacientes: new Map(),
    expedientes: new Map(),
    responsables: new Map(),
    consultas: new Map(),
    diagnosticos: new Map(),
    tratamientos: new Map(),
    recetas: new Map(),
    detalles: new Map(),
    counters: new Map(),
    catalogs: {
      municipios: new Map(),
      profesionales: new Map(),
      cie10: new Map(),
      medicamentos: new Map(),
    },
  };
}

function cloneMap<K, V>(source: Map<K, V>): Map<K, V> {
  const next = new Map<K, V>();
  for (const [key, value] of source.entries()) {
    next.set(key, structuredClone(value));
  }
  return next;
}

export function cloneMemoryMaps(source: MemoryMaps): MemoryMaps {
  return {
    pacientes: cloneMap(source.pacientes),
    expedientes: cloneMap(source.expedientes),
    responsables: cloneMap(source.responsables),
    consultas: cloneMap(source.consultas),
    diagnosticos: cloneMap(source.diagnosticos),
    tratamientos: cloneMap(source.tratamientos),
    recetas: cloneMap(source.recetas),
    detalles: cloneMap(source.detalles),
    counters: new Map(source.counters),
    catalogs: {
      municipios: cloneMap(source.catalogs.municipios),
      profesionales: cloneMap(source.catalogs.profesionales),
      cie10: cloneMap(source.catalogs.cie10),
      medicamentos: cloneMap(source.catalogs.medicamentos),
    },
  };
}

export class MemoryInstitutionState {
  private published: MemoryMaps = createEmptyMemoryMaps();

  getPublished(): MemoryMaps {
    return this.published;
  }

  publish(next: MemoryMaps): void {
    this.published = next;
  }
}

export function createMemoryInstitutionState(): MemoryInstitutionState {
  return new MemoryInstitutionState();
}

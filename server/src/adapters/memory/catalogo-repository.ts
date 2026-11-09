import type { CatalogosDto } from '@genki/shared';
import type { CatalogoRepositoryPort } from '../../ports/index.js';
import type { MemoryInstitutionState } from './state.js';
import { activeMemoryMaps } from './unit-of-work.js';

interface MemoryMunicipio {
  id_municipio: number;
  nombre: string;
}

interface MemoryProfesional {
  id_profesional: number;
  nombres: string;
  apellidos: string;
  activo?: boolean;
}

interface MemoryMedicamento {
  id_medicamento: number;
  nombre_generico: string;
  activo?: boolean;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function readMunicipio(value: unknown): MemoryMunicipio | null {
  if (!isRecord(value)) {
    return null;
  }
  if (typeof value.id_municipio !== 'number' || typeof value.nombre !== 'string') {
    return null;
  }
  return { id_municipio: value.id_municipio, nombre: value.nombre };
}

function readProfesional(value: unknown): MemoryProfesional | null {
  if (!isRecord(value)) {
    return null;
  }
  if (
    typeof value.id_profesional !== 'number' ||
    typeof value.nombres !== 'string' ||
    typeof value.apellidos !== 'string'
  ) {
    return null;
  }
  if (value.activo === false) {
    return null;
  }
  return {
    id_profesional: value.id_profesional,
    nombres: value.nombres,
    apellidos: value.apellidos,
  };
}

function readMedicamento(value: unknown): MemoryMedicamento | null {
  if (!isRecord(value)) {
    return null;
  }
  if (typeof value.id_medicamento !== 'number' || typeof value.nombre_generico !== 'string') {
    return null;
  }
  if (value.activo === false) {
    return null;
  }
  return { id_medicamento: value.id_medicamento, nombre_generico: value.nombre_generico };
}

export class MemoryCatalogoRepository implements CatalogoRepositoryPort {
  constructor(private readonly state: MemoryInstitutionState) {}

  async list(): Promise<CatalogosDto> {
    const catalogs = activeMemoryMaps(this.state).catalogs;
    const municipios = [...catalogs.municipios.values()]
      .map(readMunicipio)
      .filter((row): row is MemoryMunicipio => row !== null)
      .sort((a, b) => a.id_municipio - b.id_municipio)
      .map((row) => ({ id_municipio: row.id_municipio, nombre: row.nombre }));
    const profesionales = [...catalogs.profesionales.values()]
      .map(readProfesional)
      .filter((row): row is MemoryProfesional => row !== null)
      .sort((a, b) => a.id_profesional - b.id_profesional)
      .map((row) => ({
        id_profesional: row.id_profesional,
        nombres: row.nombres,
        apellidos: row.apellidos,
      }));
    const medicamentos = [...catalogs.medicamentos.values()]
      .map(readMedicamento)
      .filter((row): row is MemoryMedicamento => row !== null)
      .sort((a, b) => a.id_medicamento - b.id_medicamento)
      .map((row) => ({ id_medicamento: row.id_medicamento, nombre_generico: row.nombre_generico }));
    const cie10 = [...catalogs.cie10.entries()]
      .map(([key, value]) => {
        const row = isRecord(value) ? value : {};
        const codigo = typeof row.codigo_cie10 === 'string' ? row.codigo_cie10 : String(key);
        const descripcion = typeof row.descripcion === 'string' ? row.descripcion : null;
        return descripcion === null ? null : { codigo_cie10: codigo, descripcion };
      })
      .filter((row): row is { codigo_cie10: string; descripcion: string } => row !== null)
      .sort((a, b) =>
        a.codigo_cie10 < b.codigo_cie10 ? -1 : a.codigo_cie10 > b.codigo_cie10 ? 1 : 0,
      );
    return { municipios, profesionales, medicamentos, cie10 };
  }
}

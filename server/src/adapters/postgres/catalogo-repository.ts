import type { CatalogosDto } from '@genki/shared';
import type { CatalogoRepositoryPort } from '../../ports/index.js';
import { postgresQuery } from './unit-of-work.js';

/**
 * Catalog reads (C3.1): municipios all; active profesionales for the
 * institution; active medicamentos; each list sorted by id ascending.
 */
export class PostgresCatalogoRepository implements CatalogoRepositoryPort {
  constructor(private readonly institutionId: number) {}

  async list(): Promise<CatalogosDto> {
    const [municipios, profesionales, medicamentos, cie10] = await Promise.all([
      postgresQuery<{ id_municipio: number; nombre: string }>(
        `SELECT id_municipio, nombre FROM municipio ORDER BY id_municipio ASC`,
      ),
      postgresQuery<{ id_profesional: number; nombres: string; apellidos: string }>(
        `SELECT id_profesional, nombres, apellidos
           FROM profesional
          WHERE id_institucion = $1 AND activo = TRUE
          ORDER BY id_profesional ASC`,
        [this.institutionId],
      ),
      postgresQuery<{ id_medicamento: number; nombre_generico: string }>(
        `SELECT id_medicamento, nombre_generico
           FROM medicamento
          WHERE activo = TRUE
          ORDER BY id_medicamento ASC`,
      ),
      postgresQuery<{ codigo_cie10: string; descripcion: string }>(
        `SELECT codigo_cie10, descripcion FROM catalogo_cie10 ORDER BY codigo_cie10 ASC`,
      ),
    ]);

    return {
      municipios: municipios.rows.map((row) => ({
        id_municipio: row.id_municipio,
        nombre: row.nombre,
      })),
      profesionales: profesionales.rows.map((row) => ({
        id_profesional: row.id_profesional,
        nombres: row.nombres,
        apellidos: row.apellidos,
      })),
      medicamentos: medicamentos.rows.map((row) => ({
        id_medicamento: row.id_medicamento,
        nombre_generico: row.nombre_generico,
      })),
      cie10: cie10.rows.map((row) => ({
        codigo_cie10: row.codigo_cie10,
        descripcion: row.descripcion,
      })),
    };
  }
}

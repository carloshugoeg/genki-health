import type { CatalogosDto } from '@genki/shared';
import type { RowDataPacket } from 'mysql2';
import type { CatalogoRepositoryPort } from '../../ports/index.js';
import { mysqlQuery } from './unit-of-work.js';

/**
 * Catalog reads (C3.1): municipios all; active profesionales for the
 * institution; active medicamentos; each list sorted by id ascending.
 */
export class MysqlCatalogoRepository implements CatalogoRepositoryPort {
  constructor(private readonly institutionId: number) {}

  async list(): Promise<CatalogosDto> {
    const [[municipios], [profesionales], [medicamentos]] = await Promise.all([
      mysqlQuery<RowDataPacket[]>(
        `SELECT id_municipio, nombre FROM municipio ORDER BY id_municipio ASC`,
      ),
      mysqlQuery<RowDataPacket[]>(
        `SELECT id_profesional, nombres, apellidos
           FROM profesional
          WHERE id_institucion = ? AND activo = TRUE
          ORDER BY id_profesional ASC`,
        [this.institutionId],
      ),
      mysqlQuery<RowDataPacket[]>(
        `SELECT id_medicamento, nombre_generico
           FROM medicamento
          WHERE activo = TRUE
          ORDER BY id_medicamento ASC`,
      ),
    ]);

    return {
      municipios: municipios.map((row) => ({
        id_municipio: Number(row.id_municipio),
        nombre: String(row.nombre),
      })),
      profesionales: profesionales.map((row) => ({
        id_profesional: Number(row.id_profesional),
        nombres: String(row.nombres),
        apellidos: String(row.apellidos),
      })),
      medicamentos: medicamentos.map((row) => ({
        id_medicamento: Number(row.id_medicamento),
        nombre_generico: String(row.nombre_generico),
      })),
    };
  }
}

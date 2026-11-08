import type { CatalogosDto } from '@genki/shared';
import type { Db } from 'mongodb';
import type { CatalogoRepositoryPort } from '../../ports/index.js';
import { asPlainInt, toBsonInt } from './mapper.js';
import { activeMongoSession } from './unit-of-work.js';

export class MongoCatalogoRepository implements CatalogoRepositoryPort {
  constructor(
    private readonly db: Db,
    private readonly institutionId: number,
  ) {}

  async list(): Promise<CatalogosDto> {
    const session = activeMongoSession();
    const opts = session ? { session } : {};
    const filter = { institution_id: toBsonInt(this.institutionId) };

    const [municipioDocs, profesionalDocs, medicamentoDocs] = await Promise.all([
      this.db.collection('municipios').find(filter, opts).sort({ id_municipio: 1 }).toArray(),
      this.db
        .collection('profesionales')
        .find({ ...filter, activo: true }, opts)
        .sort({ id_profesional: 1 })
        .toArray(),
      this.db
        .collection('medicamentos')
        .find({ ...filter, activo: true }, opts)
        .sort({ id_medicamento: 1 })
        .toArray(),
    ]);

    return {
      municipios: municipioDocs.map((row) => ({
        id_municipio: asPlainInt(row.id_municipio),
        nombre: String(row.nombre),
      })),
      profesionales: profesionalDocs.map((row) => ({
        id_profesional: asPlainInt(row.id_profesional),
        nombres: String(row.nombres),
        apellidos: String(row.apellidos),
      })),
      medicamentos: medicamentoDocs.map((row) => ({
        id_medicamento: asPlainInt(row.id_medicamento),
        nombre_generico: String(row.nombre_generico),
      })),
    };
  }
}

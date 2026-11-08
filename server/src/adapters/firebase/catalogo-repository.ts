import type { CatalogosDto } from '@genki/shared';
import type { CatalogoRepositoryPort } from '../../ports/index.js';
import { integerId } from './mapper.js';
import type { FirebaseUnitOfWork } from './unit-of-work.js';

function text(value: unknown): string {
  if (typeof value !== 'string') throw new Error('Invalid Firestore catalog text');
  return value;
}

export class FirebaseCatalogoRepository implements CatalogoRepositoryPort {
  constructor(private readonly unitOfWork: FirebaseUnitOfWork) {}

  async list(): Promise<CatalogosDto> {
    return this.unitOfWork.runInTransaction(async () => {
      const municipios = (await this.unitOfWork.query('municipios'))
        .map((row) => ({ id_municipio: integerId(row.id_municipio), nombre: text(row.nombre) }))
        .sort((a, b) => a.id_municipio - b.id_municipio);
      const profesionales = (
        await this.unitOfWork.query('professionals', (row) => row.activo === true)
      )
        .map((row) => ({
          id_profesional: integerId(row.id_profesional),
          nombres: text(row.nombres),
          apellidos: text(row.apellidos),
        }))
        .sort((a, b) => a.id_profesional - b.id_profesional);
      const medicamentos = (
        await this.unitOfWork.query('medications', (row) => row.activo === true)
      )
        .map((row) => ({
          id_medicamento: integerId(row.id_medicamento),
          nombre_generico: text(row.nombre_generico),
        }))
        .sort((a, b) => a.id_medicamento - b.id_medicamento);
      return { municipios, profesionales, medicamentos };
    });
  }
}

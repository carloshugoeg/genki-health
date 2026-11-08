import type { CatalogosDto } from '@genki/shared';

export interface CatalogoRepositoryPort {
  list(): Promise<CatalogosDto>;
}

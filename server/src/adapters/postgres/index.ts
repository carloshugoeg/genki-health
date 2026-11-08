import pg from 'pg';
import type { AdapterResource, EngineOptions } from '../../ports/index.js';
import { PostgresCatalogoRepository } from './catalogo-repository.js';
import { PostgresConsultaRepository } from './consulta-repository.js';
import { PostgresIdPort } from './id.js';
import { PostgresPacienteRepository } from './paciente-repository.js';
import { PostgresUnitOfWork } from './unit-of-work.js';

export async function createPostgresAdapterSet(options: EngineOptions): Promise<AdapterResource> {
  const pool = new pg.Pool({ connectionString: options.url, max: 5 });
  try {
    await pool.query('SELECT 1');
  } catch (error) {
    await pool.end().catch(() => undefined);
    throw error;
  }

  const clock =
    options.clock ??
    ({
      nowIso: () => new Date().toISOString(),
    } satisfies NonNullable<EngineOptions['clock']>);
  const unitOfWork = new PostgresUnitOfWork(pool);
  const ids = new PostgresIdPort();
  const pacientes = new PostgresPacienteRepository(
    options.id_institucion,
    options.kind,
    unitOfWork,
    () => clock.nowIso(),
    options.afterWrite,
  );
  const consultas = new PostgresConsultaRepository(
    options.id_institucion,
    unitOfWork,
    options.afterWrite,
  );

  return {
    set: {
      engine: 'postgres',
      pacientes,
      consultas,
      catalogos: new PostgresCatalogoRepository(options.id_institucion),
      unitOfWork,
      clock,
      ids,
    },
    async close(): Promise<void> {
      await pool.end();
    },
  };
}

export { PostgresConsultaRepository } from './consulta-repository.js';

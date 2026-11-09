import pg from 'pg';
import type { AdapterResource, EngineOptions } from '../../ports/index.js';
import { PostgresCatalogoRepository } from './catalogo-repository.js';
import { PostgresConsultaRepository } from './consulta-repository.js';
import { createPostgresAdmissionRepository } from './full/admission.js';
import { createPostgresAttachmentsRepository } from './full/attachments.js';
import { createPostgresConsultationRepository } from './full/consultation.js';
import { createPostgresDischargeRepository } from './full/discharge.js';
import { createPostgresProcedureRepository } from './full/procedure.js';
import { createPostgresRecordRepository } from './full/record.js';
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
  const fullDeps = {
    id_institucion: options.id_institucion,
    pacientes,
    unitOfWork,
    clock,
  };

  return {
    set: {
      engine: 'postgres',
      pacientes,
      consultas,
      catalogos: new PostgresCatalogoRepository(options.id_institucion),
      unitOfWork,
      clock,
      ids,
      full: {
        record: createPostgresRecordRepository(fullDeps),
        attachments: createPostgresAttachmentsRepository(fullDeps),
        consultation: createPostgresConsultationRepository(fullDeps),
        admission: createPostgresAdmissionRepository(fullDeps),
        procedure: createPostgresProcedureRepository(fullDeps),
        discharge: createPostgresDischargeRepository(fullDeps),
      },
    },
    async close(): Promise<void> {
      await pool.end();
    },
  };
}

export { PostgresConsultaRepository } from './consulta-repository.js';

import { asInstitutionId, engineForKind } from '@genki/shared';
import type { Pool } from 'mysql2/promise';
import mysql from 'mysql2/promise';
import type { AdapterResource, EngineOptions } from '../../ports/adapter-resource.js';
import type { ClockPort } from '../../ports/clock.js';
import { MysqlCatalogoRepository } from './catalogo-repository.js';
import { MysqlConsultaRepository } from './consulta-repository.js';
import { createMysqlAttachmentsRepository } from './full/attachments.js';
import { createMysqlConsultationRepository } from './full/consultation.js';
import { createMysqlGrowthRepository } from './full/growth.js';
import { createMysqlMilestonesRepository } from './full/milestones.js';
import { createMysqlRecordRepository } from './full/record.js';
import { createMysqlVaccinesRepository } from './full/vaccines.js';
import { MysqlIdPort } from './id.js';
import { MysqlPacienteRepository } from './paciente-repository.js';
import { MysqlUnitOfWork } from './unit-of-work.js';

const defaultClock: ClockPort = {
  nowIso(): string {
    return new Date().toISOString();
  },
};

export { MysqlCatalogoRepository } from './catalogo-repository.js';
export { MysqlConsultaRepository } from './consulta-repository.js';
export { MysqlIdPort } from './id.js';
export { MysqlPacienteRepository } from './paciente-repository.js';
export {
  MysqlUnitOfWork,
  bindMysqlPool,
  mysqlQuery,
  activeMysqlConnection,
} from './unit-of-work.js';
export {
  toMysqlDate,
  toMysqlDatetime,
  fromMysqlDate,
  fromMysqlDatetime,
  fromMysqlDecimal,
  fromMysqlBoolean,
} from './mapper.js';

export async function createMysqlAdapterSet(options: EngineOptions): Promise<AdapterResource> {
  const pool: Pool = mysql.createPool({
    uri: options.url,
    connectionLimit: 5,
    timezone: 'Z',
  });

  try {
    const connection = await pool.getConnection();
    try {
      await connection.query('SELECT 1');
      await connection.query("SET time_zone = '+00:00'");
    } finally {
      connection.release();
    }
  } catch (error) {
    await pool.end().catch(() => undefined);
    throw error;
  }

  const clock = options.clock ?? defaultClock;
  const afterWrite = options.afterWrite ?? (() => {});
  const unitOfWork = new MysqlUnitOfWork(pool);
  const ids = new MysqlIdPort();
  const id_institucion = asInstitutionId(options.id_institucion);

  const pacientes = new MysqlPacienteRepository(
    id_institucion,
    options.kind,
    unitOfWork,
    () => clock.nowIso(),
    afterWrite,
  );
  const fullDeps = { id_institucion, pacientes, unitOfWork, clock };
  const set = {
    engine: engineForKind(options.kind),
    clock,
    ids,
    unitOfWork,
    pacientes,
    consultas: new MysqlConsultaRepository(id_institucion, unitOfWork, afterWrite),
    catalogos: new MysqlCatalogoRepository(options.id_institucion),
    full: {
      record: createMysqlRecordRepository(fullDeps),
      attachments: createMysqlAttachmentsRepository(fullDeps),
      consultation: createMysqlConsultationRepository(fullDeps),
      growth: createMysqlGrowthRepository(fullDeps),
      vaccines: createMysqlVaccinesRepository(fullDeps),
      milestones: createMysqlMilestonesRepository(fullDeps),
    },
  };

  return {
    set,
    async close(): Promise<void> {
      await pool.end();
    },
  };
}

import pg from 'pg';
import mysql, { type RowDataPacket } from 'mysql2/promise';
import { MongoClient } from 'mongodb';
import { asInstitutionId, asExpedienteId, INSTITUTION_ENGINE_ASSIGNMENTS } from '@genki/shared';
import { createPostgresAdapterSet } from '../adapters/postgres/index.js';
import { createMysqlAdapterSet } from '../adapters/mysql/index.js';
import { createMongoAdapterSet } from '../adapters/mongodb/index.js';
import { createFirebaseAdapterSet } from '../adapters/firebase/index.js';
import type { AdapterResource } from '../ports/index.js';
import { InstitutionAdapterRegistry, LOCKED_KIND_INSTITUTION_ID } from './adapter-registry.js';
import { createPostgresAuth } from './compose-auth.js';
import type { EnginesEnv } from './env.js';

const schemaProbe = `SELECT p.id_paciente,e.id_expediente,c.id_consulta,d.id_diagnostico,
 t.id_tratamiento,r.id_receta,dr.id_medicamento,ic.siguiente FROM paciente p
 CROSS JOIN expediente e CROSS JOIN consulta c CROSS JOIN diagnostico d
 CROSS JOIN tratamiento t CROSS JOIN receta r CROSS JOIN detalle_receta dr CROSS JOIN id_counter ic LIMIT 0`;
/** Read-only startup checks; no bootstrap, roles, migrations, seed writes or owner credentials. */
class StartupFailure extends Error {}
async function checkNative(env: EnginesEnv): Promise<void> {
  let engine = 'postgres';
  try {
    const postgres = new pg.Client({
      connectionString: env.databaseUrl,
      connectionTimeoutMillis: 5000,
      query_timeout: 5000,
    });
    try {
      await postgres.connect();
      const result = await postgres.query<{ safe: boolean }>(`SELECT current_user='genki_app_login'
      AND pg_has_role(current_user,'genki_app','member') AND NOT rolsuper AND NOT rolcreaterole AND NOT rolcreatedb
      AND NOT has_table_privilege(current_user,'usuario','SELECT') AND NOT has_table_privilege(current_user,'paciente','DELETE') AS safe
      FROM pg_roles WHERE rolname=current_user`);
      if (!result.rows[0]?.safe) throw new Error('Hospital PG clinical role mismatch');
      await postgres.query(schemaProbe);
      const counter = await postgres.query(
        "SELECT siguiente FROM id_counter WHERE nombre='receta_folio'",
      );
      if (!counter.rows.length) throw new Error('Hospital PG counter missing');
    } finally {
      await postgres.end().catch(() => undefined);
    }
    engine = 'mysql';
    const pediatric = await mysql.createConnection({ uri: env.mysqlUrl, connectTimeout: 5000 });
    try {
      const [identity] = await pediatric.query<RowDataPacket[]>(
        'SELECT CURRENT_USER() AS login,CURRENT_ROLE() AS roles',
      );
      if (
        String(identity[0]?.login).split('@')[0] !== 'genki_app_login' ||
        !String(identity[0]?.roles).includes('genki_app')
      )
        throw new Error('MySQL clinical role mismatch');
      const [grants] = await pediatric.query<RowDataPacket[]>(
        "SHOW GRANTS FOR CURRENT_USER USING 'genki_app'@'%'",
      );
      if (
        grants.some((row) =>
          Object.values(row).some((value) =>
            /\b(DELETE|DROP|ALTER|CREATE|ALL PRIVILEGES|GRANT OPTION|ADMIN OPTION)\b/.test(
              String(value),
            ),
          ),
        )
      )
        throw new Error('MySQL runtime has forbidden privileges');
      await pediatric.query(schemaProbe);
      const [counter] = await pediatric.query<RowDataPacket[]>(
        "SELECT siguiente FROM id_counter WHERE nombre='receta_folio'",
      );
      if (!counter.length) throw new Error('MySQL counter missing');
    } finally {
      await pediatric.end();
    }
    engine = 'mongodb';
    const mongo = new MongoClient(env.mongodbUri, {
      serverSelectionTimeoutMS: 5000,
      directConnection: true,
    });
    try {
      await mongo.connect();
      const db = mongo.db(new URL(env.mongodbUri).pathname.slice(1));
      const status = await db.command({ connectionStatus: 1, showPrivileges: true });
      const roles = status.authInfo?.authenticatedUserRoles as
        { role: string; db: string }[] | undefined;
      if (
        !roles?.length ||
        roles.some((role) => role.role !== 'genkiApp' || role.db !== db.databaseName)
      )
        throw new Error('Mongo clinical role mismatch');
      const privileges = status.authInfo?.authenticatedUserPrivileges as
        { resource: { db?: string; anyResource?: boolean }; actions: string[] }[] | undefined;
      if (
        !privileges?.length ||
        privileges.some(
          (entry) =>
            entry.resource.anyResource ||
            entry.resource.db !== db.databaseName ||
            entry.actions.some((action) =>
              [
                'remove',
                'dropCollection',
                'dropDatabase',
                'createIndex',
                'bypassDocumentValidation',
                'anyAction',
              ].includes(action),
            ),
        )
      )
        throw new Error('Mongo runtime has forbidden privileges');
      const names = new Set(
        (
          await db.listCollections({}, { nameOnly: true, authorizedCollections: true }).toArray()
        ).map((row) => row.name),
      );
      for (const collection of [
        'pacientes',
        'expedientes',
        'responsables',
        'consultas',
        'municipios',
        'profesionales',
        'medicamentos',
        'catalogo_cie10',
        'counters',
      ]) {
        if (!names.has(collection)) throw new Error('Mongo runtime collection missing');
        await db.collection(collection).findOne({ institution_id: 3 });
      }
      if (!(await db.collection<{ _id: string }>('counters').findOne({ _id: '3:receta_folio' })))
        throw new Error('Mongo seed counter missing');
    } finally {
      await mongo.close();
    }
  } catch {
    throw new StartupFailure(`${engine} runtime role/schema prerequisites unavailable`);
  }
}

export const engineFactories = {
  postgres: createPostgresAdapterSet,
  mysql: createMysqlAdapterSet,
  mongodb: createMongoAdapterSet,
  firebase: createFirebaseAdapterSet,
  auth: createPostgresAuth,
  checkNative,
};

/** Factories are injectable for composition tests only; live composition never imports memory. */
export async function composeEngines(env: EnginesEnv, factories = engineFactories) {
  const registry = new InstitutionAdapterRegistry();
  const owned: { close(): Promise<void> }[] = [];
  let closing: Promise<void> | undefined;
  const close = (): Promise<void> =>
    (closing ??= (async () => {
      const results = await Promise.allSettled(owned.map((resource) => resource.close()));
      if (results.some((result) => result.status === 'rejected'))
        throw new Error('Engine resource shutdown failed');
    })());
  let stage = 'native role/schema checks';
  try {
    await factories.checkNative(env);
    for (const meta of INSTITUTION_ENGINE_ASSIGNMENTS) {
      stage = `${meta.engine} initialization`;
      const id_institucion = asInstitutionId(LOCKED_KIND_INSTITUTION_ID[meta.kind]);
      const options = {
        id_institucion,
        kind: meta.kind,
        clock: { nowIso: () => new Date().toISOString() },
      };
      const resource: AdapterResource =
        meta.engine === 'firebase'
          ? await factories.firebase({
              ...options,
              projectId: env.projectId,
              emulatorHost: env.emulatorHost,
            })
          : await factories[meta.engine]({
              ...options,
              url:
                meta.engine === 'postgres'
                  ? env.databaseUrl
                  : meta.engine === 'mysql'
                    ? env.mysqlUrl
                    : env.mongodbUri,
            });
      owned.push(resource); // Own it before any further asynchronous readiness work.
      const catalog = await resource.set.catalogos.list();
      if (
        !catalog.municipios.length ||
        !catalog.profesionales.length ||
        !catalog.medicamentos.length
      )
        throw new Error('Required seeded catalogs unavailable');
      await resource.set.pacientes.list({ q: '', estado: 'todos', page: 1, page_size: 1 });
      await resource.set.consultas.listByExpediente(asExpedienteId(101));
      registry.register(meta.kind, () => resource.set);
      registry.resolve(meta.kind, id_institucion); // Validate the factory engine label eagerly.
    }
    stage = 'Hospital PG identity initialization';
    const identity = await factories.auth({ url: env.authDatabaseUrl, jwtSecret: env.jwtSecret });
    owned.push(identity);
    return { registry, auth: identity.auth, close };
  } catch (error) {
    let cleanupFailed = false;
    await close().catch(() => {
      cleanupFailed = true;
    });
    // Driver errors can embed DSNs/credentials. Preserve the safe stage, not raw error text.
    throw new Error(
      `Engine startup failed: ${error instanceof StartupFailure ? error.message : stage}; no memory fallback${cleanupFailed ? '; resource cleanup failed' : ''}`,
    );
  }
}

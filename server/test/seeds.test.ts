import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';
import { asInstitutionId, asPacienteId } from '@genki/shared';
import pg from 'pg';
import mysql, { type RowDataPacket } from 'mysql2/promise';
import { MongoClient } from 'mongodb';
import type { AdapterResource } from '../src/ports/index.js';
import { createPostgresAdapterSet } from '../src/adapters/postgres/index.js';
import { createMysqlAdapterSet } from '../src/adapters/mysql/index.js';
import { createMongoAdapterSet } from '../src/adapters/mongodb/index.js';
import { createFirebaseAdapterSet } from '../src/adapters/firebase/index.js';
import { FirebaseUnitOfWork } from '../src/adapters/firebase/unit-of-work.js';
import {
  FAKE_BANNER,
  INSTITUTIONS,
  ROLES,
  SEED_TIME,
  patients,
  runSeed,
  seedConfiguration,
} from '../../scripts/seed.js';

// Physical-only suite: existing Vitest configuration excludes this unless TEST_ENGINES=1.
// Never creates configuration/services, resets databases, or substitutes memory adapters.
describe('disposable physical seeds', () => {
  const resources: AdapterResource[] = [];
  let first: unknown;
  let second: unknown;
  let users: RowDataPacket[] | pg.QueryResultRow[];
  let guardianCounts: RowDataPacket[];

  async function snapshot(): Promise<unknown> {
    const config = seedConfiguration(process.env);
    const postgres = new pg.Client({ connectionString: config.urls[0] });
    await postgres.connect();
    const pediatric = await mysql.createConnection(config.urls[1]!);
    const mongo = new MongoClient(config.urls[2]!);
    await mongo.connect();
    const firestore = new FirebaseUnitOfWork(config.firebase);
    try {
      users = (
        await postgres.query(
          'SELECT correo,id_institucion,id_rol,nombre_usuario,hash_contrasena FROM usuario ORDER BY correo',
        )
      ).rows;
      const sqlCounts = [];
      for (const table of [
        'paciente',
        'expediente',
        'responsable',
        'consulta',
        'diagnostico',
        'tratamiento',
        'receta',
        'detalle_receta',
      ]) {
        const pgCount = await postgres.query(`SELECT COUNT(*)::int AS n FROM ${table}`);
        const [mysqlCount] = await pediatric.query<RowDataPacket[]>(
          `SELECT COUNT(*) AS n FROM ${table}`,
        );
        sqlCounts.push([pgCount.rows[0].n, Number(mysqlCount[0]?.n)]);
      }
      [guardianCounts] = await pediatric.query<RowDataPacket[]>(
        'SELECT id_paciente,COUNT(*) AS n,SUM(es_principal) AS principals FROM responsable WHERE id_paciente IN (101,102,103) GROUP BY id_paciente ORDER BY id_paciente',
      );
      const db = mongo.db(new URL(config.urls[2]!).pathname.slice(1));
      const mongoCounts = [];
      for (const collection of [
        'pacientes',
        'expedientes',
        'responsables',
        'consultas',
        'municipios',
        'profesionales',
        'medicamentos',
        'catalogo_cie10',
      ])
        mongoCounts.push(await db.collection(collection).countDocuments());
      const firestoreCounts = [];
      for (const collection of [
        'patients',
        'records',
        'responsibles',
        'consultations',
        'municipios',
        'professionals',
        'medications',
        'cie10',
        'documentKeys',
        'counters',
        'reportes',
      ])
        firestoreCounts.push((await firestore.query(collection)).length);
      return { sqlCounts, mongoCounts, firestoreCounts, users };
    } finally {
      await Promise.allSettled([postgres.end(), pediatric.end(), mongo.close(), firestore.close()]);
    }
  }

  beforeAll(async () => {
    const config = seedConfiguration(process.env);
    await runSeed(process.env, () => {});
    first = await snapshot();
    await runSeed(process.env, () => {});
    second = await snapshot();
    const factories = [createPostgresAdapterSet, createMysqlAdapterSet, createMongoAdapterSet];
    for (let index = 0; index < 3; index++) {
      const meta = INSTITUTIONS[index]!;
      resources.push(
        await factories[index]!({
          url: config.urls[index]!,
          id_institucion: asInstitutionId(meta.id),
          kind: meta.kind,
        }),
      );
    }
    resources.push(await createFirebaseAdapterSet(config.firebase));
  }, 120_000);
  afterAll(async () => {
    await Promise.allSettled(resources.map((resource) => resource.close()));
  });

  it('seed_twice_keeps_counts_and_password_hash', () => {
    expect(second).toEqual(first);
    expect(users).toHaveLength(17);
    expect(new Set(users.map((user) => user.hash_contrasena)).size).toBe(17);
    for (const user of users) expect(user.hash_contrasena).toMatch(/^\$argon2id\$/);
  });

  it('seed_has_no_real_data_or_literal_password', async () => {
    for (let index = 0; index < resources.length; index++) {
      for (const fixture of patients(index + 1)) {
        expect(await resources[index]!.set.pacientes.findById(fixture.id_paciente)).toEqual(
          fixture,
        );
      }
    }
    expect(users.map((user) => user.correo).sort()).toEqual(
      [
        ...INSTITUTIONS.flatMap((meta) =>
          ROLES.map((role) => `demo-${meta.id}-${role}@example.invalid`),
        ),
        'superadmin@example.invalid',
      ].sort(),
    );
    for (const path of [
      '../../scripts/seed.ts',
      '../src/adapters/postgres/seed.ts',
      '../src/adapters/mysql/seed.ts',
      '../src/adapters/mongodb/seed.ts',
      '../src/adapters/firebase/seed.ts',
    ]) {
      const source = await readFile(new URL(path, import.meta.url), 'utf8');
      expect(source).not.toContain(process.env.SEED_PASSWORD!);
    }
    expect(
      new Intl.DateTimeFormat('en-GB', {
        timeZone: 'America/Guatemala',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      }).format(new Date(SEED_TIME)),
    ).toBe('08:00');
  });

  it('seed_pediatric_records_have_one_principal', () => {
    expect(
      guardianCounts.map((row) => [Number(row.id_paciente), Number(row.n), Number(row.principals)]),
    ).toEqual([
      [101, 2, 1],
      [102, 2, 1],
      [103, 2, 1],
    ]);
  });

  it('seed_all_four_have_active_and_archived_history', async () => {
    for (const { set } of resources) {
      for (const id of [101, 102, 103]) {
        const record = await set.pacientes.findExpedienteByPaciente(asPacienteId(id));
        expect(record?.estado).toBe(id === 103 ? 'archivado' : 'activo');
        if (!record) throw new Error('Missing fixture record');
        expect(record.motivo_archivo).toBe(id === 103 ? 'administrativo' : null);
        const history = await set.consultas.listByExpediente(record.id_expediente);
        expect(history).toHaveLength(id === 102 ? 0 : 1);
        for (const bundle of history) {
          expect(bundle.consulta.motivo_consulta).toBe(FAKE_BANNER);
          expect(bundle.consulta.fecha_hora_inicio).toBe(SEED_TIME);
          expect(bundle.diagnosticos).toHaveLength(2);
          expect(bundle.tratamientos).toHaveLength(2);
          expect(bundle.detalles).toHaveLength(2);
          expect(bundle.receta).not.toBeNull();
        }
      }
    }
  });
});

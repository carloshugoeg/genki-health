import { readFile } from 'node:fs/promises';
import pg from 'pg';
import mysql from 'mysql2/promise';
import { MongoClient } from 'mongodb';
import { applicationDefault, initializeApp, deleteApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import {
  PostgresAgendaRepository,
  PostgresAgendaStore,
} from '../../../src/adapters/postgres/full/agenda.js';
import {
  MysqlAgendaRepository,
  MysqlAgendaStore,
} from '../../../src/adapters/mysql/full/agenda.js';
import {
  MongodbAgendaRepository,
  MongodbAgendaStore,
} from '../../../src/adapters/mongodb/full/agenda.js';
import {
  FirebaseAgendaRepository,
  FirebaseAgendaStore,
} from '../../../src/adapters/firebase/full/agenda.js';
import type { AgendaOptions } from '../../../src/application/full/agenda.js';
import type { CITA } from '@genki/shared/full/agenda';

const { Pool } = pg;
export type Engine = 'postgres' | 'mysql' | 'mongodb' | 'firebase';
function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Falta ${name} (base local de pruebas)`);
  return value;
}
/** Explicit native clients only. SQL migrations twice + document indexes are repeatable. */
export async function nativeAgenda(engine: Engine) {
  if (engine === 'postgres') {
    const pool = new Pool({ connectionString: required('AGENDA_POSTGRES_URL') });
    return {
      store: new PostgresAgendaStore(pool),
      repository: (options: AgendaOptions = {}) => new PostgresAgendaRepository(pool, options),
      migrate: async () => {
        await pool.query(
          await readFile(
            new URL(
              '../../../src/adapters/postgres/migrations/agenda/0001-cita.sql',
              import.meta.url,
            ),
            'utf8',
          ),
        );
      },
      raw: async (inst: number, id: number) => {
        const row = (
          await pool.query('SELECT * FROM agenda_cita WHERE id_institucion=$1 AND id_cita=$2', [
            inst,
            id,
          ])
        ).rows[0];
        return row;
      },
      close: () => pool.end(),
    };
  }
  if (engine === 'mysql') {
    const pool = mysql.createPool({
      uri: required('AGENDA_MYSQL_URL'),
      timezone: 'Z',
      dateStrings: true,
      multipleStatements: true,
    });
    return {
      store: new MysqlAgendaStore(pool),
      repository: (options: AgendaOptions = {}) => new MysqlAgendaRepository(pool, options),
      migrate: async () => {
        await pool.query(
          await readFile(
            new URL('../../../src/adapters/mysql/migrations/agenda/0001-cita.sql', import.meta.url),
            'utf8',
          ),
        );
      },
      raw: async (inst: number, id: number) => {
        const [rows] = await pool.query<mysql.RowDataPacket[]>(
          'SELECT * FROM agenda_cita WHERE id_institucion=? AND id_cita=?',
          [inst, id],
        );
        return rows[0];
      },
      close: () => pool.end(),
    };
  }
  if (engine === 'mongodb') {
    const client = await new MongoClient(required('AGENDA_MONGODB_URL')).connect(),
      db = client.db();
    return {
      store: new MongodbAgendaStore(client, db),
      repository: (options: AgendaOptions = {}) => new MongodbAgendaRepository(client, db, options),
      migrate: async () => {
        await db
          .collection('agenda_cita')
          .createIndex({ id_institucion: 1, id_cita: 1 }, { unique: true });
        await db
          .collection('agenda_cita')
          .createIndex({ id_institucion: 1, id_profesional: 1, fecha_hora: 1 });
      },
      raw: async (inst: number, id: number) =>
        db.collection('agenda_cita').findOne({ id_institucion: inst, id_cita: id }),
      close: () => client.close(),
    };
  }
  const real = process.env.FIRESTORE_MODE === 'real';
  projectId =
    process.env.AGENDA_FIREBASE_PROJECT_ID ??
    process.env.FIREBASE_PROJECT_ID ??
    process.env.GCLOUD_PROJECT;
  if (
    !projectId ||
    (real
      ? projectId.startsWith('demo-') || !!process.env.FIRESTORE_EMULATOR_HOST
      : !projectId.startsWith('demo-') ||
        !/^(127\.0\.0\.1|localhost):[0-9]+$/.test(process.env.FIRESTORE_EMULATOR_HOST ?? ''))
  )
    throw new Error('Explicit Firestore mode/project configuration required for agenda');
  const app = initializeApp(
      real ? { projectId, credential: applicationDefault() } : { projectId },
      `agenda-${Date.now()}-${Math.random()}`,
    ),
    firestore = getFirestore(app);
  firestore.settings({ ignoreUndefinedProperties: true });
  return {
    store: new FirebaseAgendaStore(firestore),
    repository: (options: AgendaOptions = {}) => new FirebaseAgendaRepository(firestore, options),
    migrate: async () => {
      /* Schemaless subcollections, auto single-field indexes. */
    },
    raw: async (inst: number, id: number) =>
      (await firestore.doc(`instituciones/${inst}/agenda_cita/${id}`).get()).data(),
    close: async () => {
      await firestore.terminate();
      await deleteApp(app);
    },
  };
}
export async function seedAgenda(engine: Engine) {
  const native = await nativeAgenda(engine);
  try {
    await native.migrate();
    const fixture: CITA = {
      id_cita: 900001,
      id_paciente: 900001,
      id_profesional: 900001,
      fecha_hora: '2026-11-09T14:00:00.000Z',
      duracion_minutos: 30,
      motivo: 'Fixture académica ficticia',
      estado: 'programada',
      id_usuario_registra: 900001,
      fecha_creacion: '2026-11-08T12:00:00.000Z',
    };
    const institution = { postgres: 1, mysql: 2, mongodb: 3, firebase: 4 }[engine];
    await native.store.transaction(
      institution,
      [`${institution}/900001/2026-11-09`],
      async (tx) => {
        if (!(await tx.list()).some((c) => c.id_cita === fixture.id_cita)) await tx.put(fixture);
      },
    );
  } finally {
    await native.close();
  }
}

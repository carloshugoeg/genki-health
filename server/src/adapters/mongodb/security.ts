import type { Db } from 'mongodb';

export const MONGO_APP_USER = 'genkiApp' as const;
export const MONGO_REPORT_USER = 'genkiReporter' as const;
export const MONGO_REPORT_VIEW = 'reporte_pacientes' as const;

export type MongoSecuritySecrets = {
  appPassword: string;
  reportPassword: string;
};

const CATALOG_COLLECTIONS = [
  'municipios',
  'profesionales',
  'medicamentos',
  'catalogo_cie10',
] as const;

/** Lane 1/2 clinical collections plus OP-19 audit. Keep in sync with schema.json + adapters. */
const CLINICAL_COLLECTIONS = [
  'antecedentes',
  'alergias',
  'documentos_adjuntos',
  'signos_vitales',
  'consulta_borradores',
  'ordenes_examen',
  'muestras',
  'resultados',
  'reactivacion_audit',
] as const;

const REPORT_PIPELINE = [
  {
    $group: {
      _id: { institution_id: '$institution_id', estado: '$estado' },
      cantidad: { $sum: 1 },
    },
  },
  {
    $project: {
      _id: 0,
      institution_id: '$_id.institution_id',
      estado: '$_id.estado',
      cantidad: 1,
    },
  },
] as const;

function privilege(
  dbName: string,
  collection: string,
  actions: string[],
): { resource: { db: string; collection: string }; actions: string[] } {
  return { resource: { db: dbName, collection }, actions };
}

const LANE_AB_COLLECTIONS = [
  'agenda_cita',
  'agenda_lock',
  'agenda_counter',
  'lane_a_locks',
  'lane_a_charges',
  'lane_a_services',
  'lane_a_charge_events',
  'lane_a_audit',
  'lane_a_counters',
  'lane_a_professionals',
  'lane_a_contracts',
  'lane_a_personnel_types',
  'lane_a_tariffs',
  'lane_a_supplies',
  'lane_a_consumptions',
  'lane_a_metadata',
  'lane_a_participations',
  'lane_a_roles',
  'lane_a_honoraria_snapshots',
  'lane_a_invoices',
  'lane_a_invoice_lines',
  'lane_a_payments',
  'lane_a_commands',
] as const;

function appPrivileges(dbName: string) {
  return [
    privilege(dbName, 'pacientes', ['find', 'insert']),
    privilege(dbName, 'responsables', ['find', 'insert']),
    privilege(dbName, 'consultas', ['find', 'insert']),
    privilege(dbName, 'expedientes', ['find', 'insert', 'update']),
    privilege(dbName, 'counters', ['find', 'insert', 'update']),
    ...CATALOG_COLLECTIONS.map((name) => privilege(dbName, name, ['find'])),
    ...CLINICAL_COLLECTIONS.map((name) => privilege(dbName, name, ['find', 'insert', 'update'])),
    ...LANE_AB_COLLECTIONS.map((name) => privilege(dbName, name, ['find', 'insert', 'update'])),
  ];
}

function reportPrivileges(dbName: string) {
  return [privilege(dbName, MONGO_REPORT_VIEW, ['find'])];
}

async function upsertRole(
  db: Db,
  role: string,
  privileges: ReturnType<typeof privilege>[],
): Promise<void> {
  const existing = await db.command({ rolesInfo: role, showPrivileges: true });
  const found = Array.isArray(existing.roles) && existing.roles.length > 0;
  if (found) {
    await db.command({ updateRole: role, privileges, roles: [] });
    return;
  }
  await db.command({ createRole: role, privileges, roles: [] });
}

async function upsertUser(db: Db, user: string, password: string, role: string): Promise<void> {
  const dbName = db.databaseName;
  try {
    await db.command({
      updateUser: user,
      pwd: password,
      roles: [{ role, db: dbName }],
    });
  } catch (error) {
    const code = error && typeof error === 'object' ? (error as { code?: number }).code : undefined;
    if (code !== 11) {
      throw error;
    }
    await db.command({
      createUser: user,
      pwd: password,
      roles: [{ role, db: dbName }],
    });
  }
}

async function ensureReportView(db: Db): Promise<void> {
  const existing = await db.listCollections({ name: MONGO_REPORT_VIEW }).toArray();
  if (existing.length > 0) {
    await db.dropCollection(MONGO_REPORT_VIEW);
  }
  await db.createCollection(MONGO_REPORT_VIEW, {
    viewOn: 'pacientes',
    pipeline: [...REPORT_PIPELINE],
  });
}

/**
 * C5.3 Mongo least-privilege roles, report view, and login users on `db`.
 * Passwords come from env via the caller; never hardcoded.
 */
export async function installMongoSecurity(db: Db, secrets: MongoSecuritySecrets): Promise<void> {
  if (!secrets.appPassword || !secrets.reportPassword) {
    throw new Error('installMongoSecurity requires appPassword and reportPassword');
  }
  const dbName = db.databaseName;
  await ensureReportView(db);
  await upsertRole(db, MONGO_APP_USER, appPrivileges(dbName));
  await upsertRole(db, MONGO_REPORT_USER, reportPrivileges(dbName));
  await upsertUser(db, MONGO_APP_USER, secrets.appPassword, MONGO_APP_USER);
  await upsertUser(db, MONGO_REPORT_USER, secrets.reportPassword, MONGO_REPORT_USER);
}

/** Build a replica-set URI for an app/report principal against a database. */
export function mongoAuthenticatedUri(options: {
  adminUri: string;
  database: string;
  user: typeof MONGO_APP_USER | typeof MONGO_REPORT_USER;
  password: string;
}): string {
  const parsed = new URL(options.adminUri);
  const host = parsed.host;
  if (!host) {
    throw new Error('mongoAuthenticatedUri: adminUri missing host');
  }
  const replicaSet = parsed.searchParams.get('replicaSet') ?? 'rs0';
  const user = encodeURIComponent(options.user);
  const password = encodeURIComponent(options.password);
  const database = encodeURIComponent(options.database);
  return `mongodb://${user}:${password}@${host}/${database}?authSource=${database}&replicaSet=${replicaSet}`;
}

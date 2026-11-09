import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import dotenv from 'dotenv';
import {
  asInstitutionId,
  asPacienteId,
  validatePasswordPolicy,
  type CloseConsultaRequest,
  type InstitutionKind,
  type PacienteDto,
} from '@genki/shared';
import type { AdapterResource, FirestoreOptions } from '../server/src/ports/index.js';
import { createPostgresAdapterSet } from '../server/src/adapters/postgres/index.js';
import { createMysqlAdapterSet } from '../server/src/adapters/mysql/index.js';
import { createMongoAdapterSet } from '../server/src/adapters/mongodb/index.js';
import { createFirebaseAdapterSet } from '../server/src/adapters/firebase/index.js';
import { seedPostgres, lockSeed } from '../server/src/adapters/postgres/seed.js';
import { seedMysql } from '../server/src/adapters/mysql/seed.js';
import { seedMongo } from '../server/src/adapters/mongodb/seed.js';
import { seedFirebase, seedFirebaseReport } from '../server/src/adapters/firebase/seed.js';
import { closeConsulta } from '../server/src/application/close-consulta.js';
import { archiveExpediente } from '../server/src/application/archive-expediente.js';
import { seedHistoryPlan } from './seed-history.js';

export const SEED_TIME = '2026-11-01T14:00:00.000Z';
export const FAKE_BANNER = 'Contenido académico simulado; no usar para atención';
export const ROLES = ['administrador', 'recepcion', 'medico', 'auditor'] as const;
export const INSTITUTIONS = [
  { id: 1, kind: 'hospital_general', type: 'hospital', engine: 'postgres' },
  { id: 2, kind: 'centro_pediatrico', type: 'pediatrico', engine: 'mysql' },
  { id: 3, kind: 'laboratorio_clinico', type: 'laboratorio', engine: 'mongodb' },
  { id: 4, kind: 'clinica_odontologica', type: 'odontologica', engine: 'firebase' },
] as const;
type Row = Record<string, unknown>;
interface SqlRow {
  table: string;
  key: string;
  data: Row;
  preserve?: string[];
}
interface DocRow {
  collection: string;
  id: number | string;
  data: Row;
  preserve?: string[];
}
const preservedRecord = [
  'estado',
  'fecha_archivo',
  'motivo_archivo',
  'observacion_archivo',
  '_rev',
  'revision',
];

export function patients(institution: number): PacienteDto[] {
  return ['Uno', 'Dos', 'Tres'].map((name, index) => ({
    id_paciente: asPacienteId(101 + index),
    id_institucion: asInstitutionId(institution),
    tipo_documento: 'OTRO',
    numero_documento: `DEMO-${institution}-00${index + 1}`,
    primer_nombre: 'Paciente',
    segundo_nombre: 'Ejemplo',
    primer_apellido: name,
    segundo_apellido: null,
    fecha_nacimiento: ['1990-01-01', '2018-01-01', '1980-01-01'][index]!,
    sexo: 'X',
    tipo_sangre: null,
    telefono: null,
    correo: null,
    direccion: null,
    id_municipio: 1,
    fecha_registro: SEED_TIME,
    estado: 'activo',
  }));
}
export function guardians(patient: number): Row[] {
  return [true, false].map((principal, index) => ({
    id_responsable: 101 + (patient - 101) * 2 + index,
    id_paciente: patient,
    tipo_documento: 'OTRO',
    numero_documento: `DEMO-2-G${patient}-${index + 1}`,
    nombre_completo: `Responsable Simulado ${patient} ${index + 1}`,
    parentesco: 'tutor_legal',
    telefono: '00000000',
    correo: null,
    direccion: null,
    es_principal: principal,
  }));
}
const record = (patient: number): Row => ({
  id_expediente: patient,
  id_paciente: patient,
  numero_expediente: `EXP-${patient}`,
  fecha_apertura: SEED_TIME,
  estado: 'activo',
  fecha_archivo: null,
  motivo_archivo: null,
  observacion_archivo: null,
});
const professionals = (institution: number): Row[] =>
  [1, 2].map((id) => ({
    id_profesional: id,
    nombres: 'Profesional',
    apellidos: `Simulado ${institution}${id === 2 ? ' Auxiliar' : ''}`,
    numero_colegiado: id === 1 ? `DEMO-${institution}-1` : null,
    activo: true,
  }));
const medications = (): Row[] =>
  [1, 2, 3].map((id) => ({
    id_medicamento: id,
    nombre_generico: `Medicamento didáctico ${['A', 'B', 'Inactivo'][id - 1]}`,
    activo: id !== 3,
  }));
const cie10 = { codigo_cie10: 'Z00.0', descripcion: 'Examen médico general' };

export function sqlFixtures(institution: 1 | 2): SqlRow[] {
  const rows: SqlRow[] = [];
  const add = (table: string, key: string, data: Row, preserve?: string[]) =>
    rows.push({ table, key, data, ...(preserve ? { preserve } : {}) });
  for (const meta of INSTITUTIONS.filter((i) => institution === 1 || i.id === institution)) {
    add('institucion', 'id_institucion', {
      id_institucion: meta.id,
      nombre: `Institución de demostración ${meta.id}`,
      tipo: meta.type,
      nit: `DEMO-${meta.id}`,
      direccion: 'Dirección simulada',
      telefono: '00000000',
      correo: `demo-institucion-${meta.id}@example.invalid`,
      motor_datos: meta.engine,
      activo: true,
    });
  }
  add('municipio', 'id_municipio', { id_municipio: 1, nombre: 'Municipio de prueba' });
  add('especialidad', 'id_especialidad', {
    id_especialidad: 1,
    nombre: 'General de demostración',
    descripcion: FAKE_BANNER,
  });
  add('tipo_personal', 'id_tipo_personal', {
    id_tipo_personal: 1,
    nombre: 'medico',
    requiere_colegiado: true,
    genera_honorario: false,
  });
  add('tipo_personal', 'id_tipo_personal', {
    id_tipo_personal: 2,
    nombre: 'auxiliar',
    requiere_colegiado: false,
    genera_honorario: false,
  });
  for (const professional of professionals(institution))
    add('profesional', 'id_profesional', {
      ...professional,
      id_institucion: institution,
      id_especialidad: 1,
      telefono: null,
      correo: null,
    });
  for (const medication of medications())
    add('medicamento', 'id_medicamento', {
      ...medication,
      nombre_comercial: null,
      principio_activo: FAKE_BANNER,
      concentracion: 'Simulada',
      forma_farmaceutica: 'Simulada',
      presentacion: FAKE_BANNER,
      requiere_receta: true,
    });
  add('catalogo_cie10', 'codigo_cie10', { ...cie10, capitulo: null });
  for (const patient of patients(institution)) {
    add('paciente', 'id_paciente', { ...patient });
    add('expediente', 'id_expediente', record(patient.id_paciente), preservedRecord);
    if (institution === 2)
      for (const guardian of guardians(patient.id_paciente))
        add('responsable', 'id_responsable', guardian);
  }
  if (institution === 1) {
    ROLES.forEach((role, index) =>
      add('rol', 'id_rol', { id_rol: index + 1, nombre: role, descripcion: FAKE_BANNER }),
    );
    add('rol', 'id_rol', {
      id_rol: 5,
      nombre: 'superadministrador',
      descripcion: FAKE_BANNER,
    });
  }
  if (institution === 2)
    for (const row of rows)
      for (const [key, value] of Object.entries(row.data)) {
        if (typeof value === 'string' && value === SEED_TIME)
          row.data[key] = value.replace('T', ' ').replace('Z', '');
      }
  return rows;
}
export function documentFixtures(institution: 3 | 4): DocRow[] {
  const mongo = institution === 3;
  const rows: DocRow[] = [
    { collection: 'municipios', id: 1, data: { id_municipio: 1, nombre: 'Municipio de prueba' } },
    ...professionals(institution).map((data) => ({
      collection: mongo ? 'profesionales' : 'professionals',
      id: Number(data.id_profesional),
      data,
    })),
    ...medications().map((data) => ({
      collection: mongo ? 'medicamentos' : 'medications',
      id: Number(data.id_medicamento),
      data,
    })),
    { collection: mongo ? 'catalogo_cie10' : 'cie10', id: 'Z00.0', data: cie10 },
  ];
  for (const patient of patients(institution)) {
    rows.push({
      collection: mongo ? 'pacientes' : 'patients',
      id: patient.id_paciente,
      data: { ...patient },
    });
    rows.push({
      collection: mongo ? 'expedientes' : 'records',
      id: patient.id_paciente,
      data: { ...record(patient.id_paciente), [mongo ? '_rev' : 'revision']: 0 },
      preserve: preservedRecord,
    });
  }
  return rows;
}
export function consultation(): CloseConsultaRequest {
  return {
    id_profesional: 1,
    fecha_hora_inicio: SEED_TIME,
    tipo: 'primera_vez',
    motivo_consulta: FAKE_BANNER,
    enfermedad_actual: FAKE_BANNER,
    exploracion_fisica: FAKE_BANNER,
    plan: FAKE_BANNER,
    diagnosticos: [true, false].map((principal) => ({
      codigo_cie10: 'Z00.0',
      descripcion: FAKE_BANNER,
      tipo: 'definitivo',
      es_principal: principal,
    })),
    tratamientos: [0, 1].map((index) => ({
      diagnostico_index: index,
      tipo: 'farmacologico',
      descripcion: FAKE_BANNER,
      indicaciones: FAKE_BANNER,
      fecha_inicio: '2026-11-01',
      fecha_fin_estimada: null,
      estado: 'activo',
    })),
    receta: {
      observaciones: FAKE_BANNER,
      detalles: [1, 2].map((id) => ({
        id_medicamento: id,
        dosis: FAKE_BANNER,
        via_administracion: 'Simulada',
        frecuencia_horas: 24,
        duracion_dias: 1,
        cantidad: 1,
        indicaciones: FAKE_BANNER,
      })),
    },
  };
}

function required(env: NodeJS.ProcessEnv, name: string): string {
  if (!env[name]) throw new Error(`Missing required env: ${name}`);
  return env[name];
}
export function seedConfiguration(env: NodeJS.ProcessEnv) {
  const password = required(env, 'SEED_PASSWORD');
  if (validatePasswordPolicy(password)) throw new Error('SEED_PASSWORD violates password_policy');
  const urls = ['PG_ADMIN_URL', 'MYSQL_ADMIN_URL', 'MONGO_ADMIN_URI'].map((name) => {
    const raw = required(env, name);
    let url: URL;
    try {
      url = new URL(raw);
    } catch {
      throw new Error(`Invalid ${name}`);
    }
    if (
      !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname) ||
      !/^\/genki_test_[a-z0-9_]+$/.test(url.pathname)
    )
      throw new Error(`${name} requires a loopback disposable genki_test_ database`);
    const protocols =
      name === 'PG_ADMIN_URL'
        ? ['postgres:', 'postgresql:']
        : name === 'MYSQL_ADMIN_URL'
          ? ['mysql:']
          : ['mongodb:'];
    const queryKeys =
      name === 'MONGO_ADMIN_URI'
        ? ['authSource', 'replicaSet', 'directConnection']
        : name === 'PG_ADMIN_URL'
          ? ['sslmode']
          : [];
    if (
      !protocols.includes(url.protocol) ||
      [...url.searchParams.keys()].some((key) => !queryKeys.includes(key))
    )
      throw new Error(`Unsupported connection options in ${name}`);
    // Prevent replica discovery from redirecting this local demo-only operation elsewhere.
    if (name === 'MONGO_ADMIN_URI') url.searchParams.set('directConnection', 'true');
    return url.toString();
  });
  const firestoreMode = (env.FIRESTORE_MODE ?? 'emulator').trim() || 'emulator';
  if (firestoreMode !== 'emulator' && firestoreMode !== 'real')
    throw new Error('FIRESTORE_MODE must be emulator or real');
  let firebase: FirestoreOptions;
  if (firestoreMode === 'real') {
    const projectId = required(env, 'GCLOUD_PROJECT');
    if (projectId === 'demo-genki-health' || /^demo-[a-z0-9-]+$/.test(projectId))
      throw new Error('FIRESTORE_MODE=real requires a non-demo GCLOUD_PROJECT');
    if (!required(env, 'GOOGLE_APPLICATION_CREDENTIALS').trim())
      throw new Error('FIRESTORE_MODE=real requires GOOGLE_APPLICATION_CREDENTIALS');
    firebase = {
      id_institucion: asInstitutionId(4),
      kind: 'clinica_odontologica',
      projectId,
      emulatorHost: '',
      clock: { nowIso: () => SEED_TIME },
    };
  } else {
    const emulatorHost = required(env, 'FIRESTORE_EMULATOR_HOST');
    if (
      !/^(127\.0\.0\.1|localhost|\[::1\]):[0-9]+$/.test(emulatorHost) ||
      required(env, 'GCLOUD_PROJECT') !== 'demo-genki-health'
    )
      throw new Error('Fixed demo project and loopback emulator required');
    firebase = {
      id_institucion: asInstitutionId(4),
      kind: 'clinica_odontologica',
      projectId: 'demo-genki-health',
      emulatorHost,
      clock: { nowIso: () => SEED_TIME },
    };
  }
  return { password, urls, firebase };
}

/** All four must initialize before any writes. A later failure is fatal, never fake success. */
export async function runSeed(
  env: NodeJS.ProcessEnv = process.env,
  report: (line: string) => void = console.log,
): Promise<void> {
  const config = seedConfiguration(env); // Validate every target and password before connecting.
  const resources: AdapterResource[] = [];
  let unlock: (() => Promise<void>) | undefined;
  let stage = 'preflight';
  try {
    const factories = [createPostgresAdapterSet, createMysqlAdapterSet, createMongoAdapterSet];
    for (let index = 0; index < 3; index++) {
      stage = `${INSTITUTIONS[index]!.engine} preflight`;
      const meta = INSTITUTIONS[index]!;
      resources.push(
        await factories[index]!({
          id_institucion: asInstitutionId(meta.id),
          kind: meta.kind as InstitutionKind,
          url: config.urls[index]!,
          clock: { nowIso: () => SEED_TIME },
        }),
      );
    }
    stage = 'firebase preflight';
    resources.push(await createFirebaseAdapterSet(config.firebase));
    for (const resource of resources) await resource.set.catalogos.list();
    stage = 'seed command lock';
    unlock = await lockSeed(config.urls[0]!);
    const bootstrap = [
      () => seedPostgres(config.urls[0]!, sqlFixtures(1), config.password),
      () => seedMysql(config.urls[1]!, sqlFixtures(2)),
      () => seedMongo(config.urls[2]!, documentFixtures(3)),
      () => seedFirebase(config.firebase, documentFixtures(4)),
    ];
    for (let index = 0; index < 4; index++) {
      const meta = INSTITUTIONS[index]!;
      const adapters = resources[index]!.set;
      stage = `${meta.engine} bootstrap`;
      await bootstrap[index]!();
      stage = `${meta.engine} history/archive`;
      for (const id of [101, 102, 103]) {
        // The command lock prevents duplicate history across concurrent seed commands.
        await adapters.unitOfWork.runInTransaction(async () => {
          const patient = await adapters.pacientes.findByDocumento(
            'OTRO',
            `DEMO-${meta.id}-00${id - 100}`,
          );
          if (!patient || patient.id_paciente !== id) throw new Error('Seed fixed-ID conflict');
          const expediente = await adapters.pacientes.findExpedienteByPaciente(patient.id_paciente);
          if (!expediente) throw new Error('Seed expediente missing');
          const history = await adapters.consultas.listByExpediente(expediente.id_expediente);
          const plan = seedHistoryPlan(id, history, FAKE_BANNER, SEED_TIME);
          if (plan === 'reject') {
            throw new Error(
              'Seed existing history conflicts with the fixed fixture; preserved without reset',
            );
          }
          if (plan === 'create') {
            await closeConsulta(adapters, {
              id_paciente: patient.id_paciente,
              body: consultation(),
            });
          }
          if (id === 103 && expediente.estado !== 'archivado')
            await archiveExpediente(adapters.pacientes, adapters.clock, {
              id_paciente: patient.id_paciente,
              id_expediente: expediente.id_expediente,
              motivo_archivo: 'administrativo',
              observacion_archivo: FAKE_BANNER,
            });
          if (id !== 103 && expediente.estado !== 'activo')
            throw new Error('Seed active fixture has been archived; existing data preserved');
        });
      }
    }
    stage = 'document counter reservation';
    await seedMongo(config.urls[2]!, []);
    await seedFirebase(config.firebase, []);
    stage = 'firebase initial-load snapshot';
    await seedFirebaseReport(config.firebase);
    // Success only after every institution has completed. No names, documents or hashes logged.
    for (let index = 0; index < resources.length; index++) {
      const counts = await resources[index]!.set.pacientes.list({
        q: '',
        estado: 'todos',
        page: 1,
        page_size: 1,
      });
      report(
        `institution=${index + 1} engine=${INSTITUTIONS[index]!.engine} patients=${counts.total}${index === 0 ? ' identities=17' : ''}`,
      );
    }
  } catch (error) {
    const code =
      error && typeof error === 'object' && 'code' in error ? String(error.code) : 'seed_error';
    // Native errors can include credentials or clinical values. Only local seed messages are safe.
    const reason =
      error instanceof Error && /^(Seed |Invalid seed|SEED_PASSWORD)/.test(error.message)
        ? error.message
        : /^[A-Za-z0-9_-]+$/.test(code)
          ? code
          : 'seed_error';
    throw new Error(
      `Seed failed at ${stage}: ${reason}. Earlier institution transactions may have committed; rerun preserves existing fixtures.`,
    );
  } finally {
    await Promise.allSettled(resources.map((resource) => resource.close()));
    await unlock?.();
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  dotenv.config({
    path: resolve(dirname(fileURLToPath(import.meta.url)), '../.env'),
    override: false,
  });
  runSeed().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : 'Seed failed');
    process.exitCode = 1;
  });
}

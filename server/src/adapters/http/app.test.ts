import { describe, expect, it } from 'vitest';
import type {
  AuthTokensDto,
  CloseConsultaRequest,
  ErrorDto,
  HistorialDto,
  PacientePage,
  PacienteResumen,
  RegisterPacienteRequest,
} from '@genki/shared';
import { closeConsulta } from '../../application/close-consulta.js';
import { registerPaciente } from '../../application/register-paciente.js';
import { InstitutionAdapterRegistry } from '../../config/adapter-registry.js';
import {
  createPhase0Auth,
  createPhase0Identity,
  createPhase0Registry,
} from '../../config/compose-memory.js';
import {
  createTestMemoryAdapterSet,
  type TestMemoryAdapterSet,
} from '../../config/memory-test-factory.js';
import type { IdentityUser } from '../../ports/identity-store.js';
import { testCredentials } from '../../test/credentials.js';
import {
  SEED_CIE10,
  SEED_MEDICAMENTO_1,
  SEED_PROFESIONAL_ID,
  expectedPrimaryCatalog,
} from '../../testing/catalog-seeds.js';
import { buildDemoUsers } from '../memory/auth.js';
import { buildHttpApp } from './app.js';
import { DOCUMENT_BODY_LIMIT_BYTES } from './full-routes.js';

function adult(numero_documento: string, name = 'Ana'): RegisterPacienteRequest {
  return {
    tipo_documento: 'DPI',
    numero_documento,
    primer_nombre: name,
    primer_apellido: 'Lopez',
    fecha_nacimiento: '1990-01-15',
    sexo: 'F',
  };
}

function seedHospitalCatalogs(set: TestMemoryAdapterSet): void {
  const catalogs = set.memoryState.getPublished().catalogs;
  const expected = expectedPrimaryCatalog();
  catalogs.municipios.clear();
  catalogs.profesionales.clear();
  catalogs.medicamentos.clear();
  catalogs.cie10.clear();
  for (const row of expected.municipios) {
    catalogs.municipios.set(row.id_municipio, row);
  }
  for (const row of expected.profesionales) {
    catalogs.profesionales.set(row.id_profesional, { ...row, activo: true });
  }
  for (const row of expected.medicamentos) {
    catalogs.medicamentos.set(row.id_medicamento, { ...row, activo: true });
  }
  catalogs.cie10.set(SEED_CIE10, { codigo_cie10: SEED_CIE10, descripcion: 'Examen general' });
}

function closeBody(): CloseConsultaRequest {
  return {
    id_profesional: SEED_PROFESIONAL_ID,
    fecha_hora_inicio: '2026-11-07T15:00:00.000Z',
    tipo: 'primera_vez',
    motivo_consulta: 'Control',
    enfermedad_actual: null,
    exploracion_fisica: null,
    plan: null,
    diagnosticos: [
      {
        codigo_cie10: SEED_CIE10,
        descripcion: 'Examen general',
        tipo: 'presuntivo',
        es_principal: true,
      },
    ],
    tratamientos: [
      {
        diagnostico_index: 0,
        tipo: 'farmacologico',
        descripcion: 'Analgesico',
        indicaciones: null,
        fecha_inicio: '2026-11-07',
        fecha_fin_estimada: null,
        estado: 'activo',
      },
    ],
    receta: {
      observaciones: null,
      detalles: [
        {
          id_medicamento: SEED_MEDICAMENTO_1,
          dosis: '500mg',
          via_administracion: 'oral',
          frecuencia_horas: 8,
          duracion_dias: 5,
          cantidad: 15,
          indicaciones: null,
        },
      ],
    },
  };
}

async function hospitalIdentityUsers(): Promise<IdentityUser[]> {
  const { password } = testCredentials();
  const demos = await buildDemoUsers(password);
  const hash = demos[0]!.hash_contrasena;
  return [
    ...demos,
    {
      id_usuario: 10,
      email: 'auditor@genki.local',
      hash_contrasena: hash,
      id_institucion: 1,
      institution_kind: 'hospital_general',
      roles: ['auditor'],
      estado: 'activo',
    },
    {
      id_usuario: 11,
      email: 'recepcion@genki.local',
      hash_contrasena: hash,
      id_institucion: 1,
      institution_kind: 'hospital_general',
      roles: ['recepcion'],
      estado: 'activo',
    },
    {
      id_usuario: 12,
      email: 'medico-h@genki.local',
      hash_contrasena: hash,
      id_institucion: 1,
      institution_kind: 'hospital_general',
      roles: ['medico'],
      estado: 'activo',
    },
  ];
}

async function authWithHospitalRoles() {
  const { jwtSecret } = testCredentials();
  return createPhase0Auth(jwtSecret, await hospitalIdentityUsers());
}

async function identityWithHospitalRoles() {
  const { jwtSecret } = testCredentials();
  return createPhase0Identity(jwtSecret, await hospitalIdentityUsers());
}

function clinicalRegistry(
  hospital: TestMemoryAdapterSet,
  pediatric: TestMemoryAdapterSet,
  dental: TestMemoryAdapterSet = createTestMemoryAdapterSet('clinica_odontologica', 4),
) {
  const registry = new InstitutionAdapterRegistry();
  registry.register('hospital_general', () => hospital);
  registry.register('centro_pediatrico', () => pediatric);
  registry.register('laboratorio_clinico', () =>
    createTestMemoryAdapterSet('laboratorio_clinico', 3),
  );
  registry.register('clinica_odontologica', () => dental);
  return registry;
}

async function loginAs(
  app: ReturnType<typeof buildHttpApp>,
  email: string,
  institution_kind:
    | 'hospital_general'
    | 'centro_pediatrico'
    | 'laboratorio_clinico'
    | 'clinica_odontologica' = 'hospital_general',
): Promise<string> {
  const { password } = testCredentials();
  const login = await app.inject({
    method: 'POST',
    url: '/api/auth/login',
    payload: { email, password, institution_kind },
  });
  expect(login.statusCode).toBe(200);
  return (login.json() as AuthTokensDto).access_token;
}

describe('HTTP auth routing', () => {
  it('returns tokens from login and routes pacientes via JWT institution', async () => {
    const { password, jwtSecret } = testCredentials();
    const auth = await createPhase0Auth(jwtSecret);
    const app = buildHttpApp({ registry: createPhase0Registry(), auth });

    const login = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: {
        email: 'hospital@genki.local',
        password,
        institution_kind: 'hospital_general',
      },
    });
    expect(login.statusCode).toBe(200);
    const tokens = login.json() as { access_token: string; refresh_token: string };

    const unauthorized = await app.inject({
      method: 'POST',
      url: '/api/pacientes',
      payload: {
        tipo_documento: 'DPI',
        numero_documento: '1',
        primer_nombre: 'Ana',
        primer_apellido: 'López',
        fecha_nacimiento: '1990-01-01',
        sexo: 'F',
      },
    });
    expect(unauthorized.statusCode).toBe(401);

    const created = await app.inject({
      method: 'POST',
      url: '/api/pacientes',
      headers: { authorization: `Bearer ${tokens.access_token}` },
      payload: {
        tipo_documento: 'DPI',
        numero_documento: '1',
        primer_nombre: 'Ana',
        primer_apellido: 'López',
        fecha_nacimiento: '1990-01-01',
        sexo: 'F',
      },
    });
    expect(created.statusCode).toBe(201);
    const body = created.json() as { paciente: { id_institucion: number } };
    expect(body.paciente.id_institucion).toBe(1);

    const logout = await app.inject({
      method: 'POST',
      url: '/api/auth/logout',
      payload: { refresh_token: tokens.refresh_token },
    });
    expect(logout.statusCode).toBe(204);

    const replay = await app.inject({
      method: 'POST',
      url: '/api/auth/refresh',
      payload: { refresh_token: tokens.refresh_token },
    });
    expect(replay.statusCode).toBe(401);
  });
});

describe('HTTP patient search detail catalog archive', () => {
  it('search_returns_only_active_by_default', async () => {
    const hospital = createTestMemoryAdapterSet('hospital_general', 1);
    const pediatric = createTestMemoryAdapterSet('centro_pediatrico', 2);
    seedHospitalCatalogs(hospital);
    const auth = await authWithHospitalRoles();
    const app = buildHttpApp({ registry: clinicalRegistry(hospital, pediatric), auth });
    const token = await loginAs(app, 'hospital@genki.local');

    const active = await app.inject({
      method: 'POST',
      url: '/api/pacientes',
      headers: { authorization: `Bearer ${token}` },
      payload: adult('SEARCH-ACT'),
    });
    expect(active.statusCode).toBe(201);
    const archivedSeed = await app.inject({
      method: 'POST',
      url: '/api/pacientes',
      headers: { authorization: `Bearer ${token}` },
      payload: adult('SEARCH-ARC', 'Beto'),
    });
    expect(archivedSeed.statusCode).toBe(201);
    const archivedId = (archivedSeed.json() as PacienteResumen).paciente.id_paciente;

    const archived = await app.inject({
      method: 'POST',
      url: `/api/pacientes/${archivedId}/archivo`,
      headers: { authorization: `Bearer ${token}` },
      payload: { motivo_archivo: 'administrativo' },
    });
    expect(archived.statusCode).toBe(200);

    const page = await app.inject({
      method: 'GET',
      url: '/api/pacientes',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(page.statusCode).toBe(200);
    const body = page.json() as PacientePage;
    expect(body.total).toBe(1);
    expect(body.items).toHaveLength(1);
    expect(body.items[0]?.paciente.numero_documento).toBe('SEARCH-ACT');
    expect(body.items.every((row) => row.expediente.estado === 'activo')).toBe(true);

    const todos = await app.inject({
      method: 'GET',
      url: '/api/pacientes?estado=todos',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(todos.statusCode).toBe(200);
    expect((todos.json() as PacientePage).total).toBe(2);
  });

  it('detail_contains_complete_history', async () => {
    const hospital = createTestMemoryAdapterSet('hospital_general', 1);
    const pediatric = createTestMemoryAdapterSet('centro_pediatrico', 2);
    seedHospitalCatalogs(hospital);
    const auth = await authWithHospitalRoles();
    const app = buildHttpApp({ registry: clinicalRegistry(hospital, pediatric), auth });
    const token = await loginAs(app, 'hospital@genki.local');

    const created = await app.inject({
      method: 'POST',
      url: '/api/pacientes',
      headers: { authorization: `Bearer ${token}` },
      payload: adult('HIST-001'),
    });
    expect(created.statusCode).toBe(201);
    const resumen = created.json() as PacienteResumen;
    const id = resumen.paciente.id_paciente;

    await closeConsulta(hospital, { id_paciente: id, body: closeBody() });

    const detail = await app.inject({
      method: 'GET',
      url: `/api/pacientes/${id}`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(detail.statusCode).toBe(200);
    const historial = detail.json() as HistorialDto;
    expect(historial.paciente.id_paciente).toBe(id);
    expect(historial.expediente.id_paciente).toBe(id);
    expect(historial.consultas).toHaveLength(1);
    expect(historial.consultas[0]?.consulta.estado).toBe('cerrada');
    expect(historial.consultas[0]?.diagnosticos.length).toBeGreaterThanOrEqual(1);
    expect(historial.consultas[0]?.tratamientos.length).toBeGreaterThanOrEqual(1);
    expect(historial.consultas[0]?.receta).not.toBeNull();
    expect(historial.consultas[0]?.detalles.length).toBeGreaterThanOrEqual(1);

    const catalogs = await app.inject({
      method: 'GET',
      url: '/api/catalogos',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(catalogs.statusCode).toBe(200);
    const catalogBody = catalogs.json() as {
      municipios: unknown[];
      profesionales: unknown[];
      medicamentos: unknown[];
    };
    expect(catalogBody.profesionales.length).toBeGreaterThanOrEqual(1);
    expect(catalogBody.medicamentos.length).toBeGreaterThanOrEqual(1);
  });

  it('archive_endpoint_uses_patient_owned_record', async () => {
    const hospital = createTestMemoryAdapterSet('hospital_general', 1);
    const pediatric = createTestMemoryAdapterSet('centro_pediatrico', 2);
    const auth = await authWithHospitalRoles();
    const app = buildHttpApp({ registry: clinicalRegistry(hospital, pediatric), auth });
    const token = await loginAs(app, 'recepcion@genki.local');

    const created = await app.inject({
      method: 'POST',
      url: '/api/pacientes',
      headers: { authorization: `Bearer ${token}` },
      payload: adult('ARCH-HTTP-1'),
    });
    expect(created.statusCode).toBe(201);
    const resumen = created.json() as PacienteResumen;
    const id = resumen.paciente.id_paciente;
    const expedienteId = resumen.expediente.id_expediente;

    const forged = await app.inject({
      method: 'POST',
      url: `/api/pacientes/${id}/archivo`,
      headers: { authorization: `Bearer ${token}` },
      payload: {
        motivo_archivo: 'traslado',
        id_expediente: expedienteId + 99,
      },
    });
    expect(forged.statusCode).toBe(400);
    expect((forged.json() as ErrorDto).error).toBe('invalid_body');

    const archived = await app.inject({
      method: 'POST',
      url: `/api/pacientes/${id}/archivo`,
      headers: { authorization: `Bearer ${token}` },
      payload: { motivo_archivo: 'traslado', observacion_archivo: 'mudanza' },
    });
    expect(archived.statusCode).toBe(200);
    const body = archived.json() as {
      id_expediente: number;
      id_paciente: number;
      estado: string;
      motivo_archivo: string;
    };
    expect(body.id_expediente).toBe(expedienteId);
    expect(body.id_paciente).toBe(id);
    expect(body.estado).toBe('archivado');
    expect(body.motivo_archivo).toBe('traslado');

    const still = await hospital.pacientes.findById(id);
    expect(still?.estado).toBe('activo');
  });

  it('foreign_patient_returns_404', async () => {
    const hospital = createTestMemoryAdapterSet('hospital_general', 1);
    const pediatric = createTestMemoryAdapterSet('centro_pediatrico', 2);
    const auth = await authWithHospitalRoles();
    const app = buildHttpApp({ registry: clinicalRegistry(hospital, pediatric), auth });

    const pedToken = await loginAs(app, 'pediatrico@genki.local', 'centro_pediatrico');
    // Pediatric register needs guardians; seed via repository to avoid register HTTP role/guardian matrix.
    const foreign = await pediatric.pacientes.createWithExpediente({
      ...adult('FOREIGN-1'),
      responsables: [
        {
          tipo_documento: 'DPI',
          numero_documento: 'GUARD-1',
          nombre_completo: 'Tutor Principal',
          parentesco: 'madre',
          telefono: '5555-0000',
          es_principal: true,
        },
      ],
    });

    const hospitalToken = await loginAs(app, 'hospital@genki.local');
    const detail = await app.inject({
      method: 'GET',
      url: `/api/pacientes/${foreign.paciente.id_paciente}`,
      headers: { authorization: `Bearer ${hospitalToken}` },
    });
    expect(detail.statusCode).toBe(404);
    expect(detail.json()).toEqual({
      error: 'not_found',
      message: 'Recurso no encontrado',
    });

    const archive = await app.inject({
      method: 'POST',
      url: `/api/pacientes/${foreign.paciente.id_paciente}/archivo`,
      headers: { authorization: `Bearer ${hospitalToken}` },
      payload: { motivo_archivo: 'administrativo' },
    });
    expect(archive.statusCode).toBe(404);
    expect((archive.json() as ErrorDto).error).toBe('not_found');

    void pedToken;
  });

  it('op19_reactivate_expediente', async () => {
    const hospital = createTestMemoryAdapterSet('hospital_general', 1);
    const pediatric = createTestMemoryAdapterSet('centro_pediatrico', 2);
    const auth = await authWithHospitalRoles();
    const app = buildHttpApp({ registry: clinicalRegistry(hospital, pediatric), auth });
    const token = await loginAs(app, 'hospital@genki.local');

    const created = await app.inject({
      method: 'POST',
      url: '/api/pacientes',
      headers: { authorization: `Bearer ${token}` },
      payload: adult('REACT-1'),
    });
    const id = (created.json() as PacienteResumen).paciente.id_paciente;
    const archived = await app.inject({
      method: 'POST',
      url: `/api/pacientes/${id}/archivo`,
      headers: { authorization: `Bearer ${token}` },
      payload: { motivo_archivo: 'inactividad' },
    });
    expect(archived.statusCode).toBe(200);
    expect((archived.json() as { estado: string }).estado).toBe('archivado');

    const reactivated = await app.inject({
      method: 'POST',
      url: `/api/pacientes/${id}/reactivacion`,
      headers: {
        authorization: `Bearer ${token}`,
        'idempotency-key': 'op19-react-1',
      },
      payload: { motivo: 'Reingreso administrativo de prueba' },
    });
    expect(reactivated.statusCode).toBe(200);
    const body = reactivated.json() as {
      estado: string;
      fecha_archivo: string | null;
      motivo_archivo: string | null;
      observacion_archivo: string | null;
    };
    expect(body.estado).toBe('activo');
    expect(body.fecha_archivo).toBeNull();
    expect(body.motivo_archivo).toBeNull();
    expect(body.observacion_archivo).toBeNull();

    for (const method of ['PUT', 'PATCH'] as const) {
      const missing = await app.inject({
        method,
        url: `/api/pacientes/${id}/reactivacion`,
        headers: { authorization: `Bearer ${token}` },
        payload: { motivo: 'x' },
      });
      expect(missing.statusCode).toBe(404);
    }
  });

  it('invalid_query_returns_safe_error', async () => {
    const hospital = createTestMemoryAdapterSet('hospital_general', 1);
    const pediatric = createTestMemoryAdapterSet('centro_pediatrico', 2);
    const auth = await authWithHospitalRoles();
    const app = buildHttpApp({ registry: clinicalRegistry(hospital, pediatric), auth });
    const token = await loginAs(app, 'hospital@genki.local');

    const badEstado = await app.inject({
      method: 'GET',
      url: '/api/pacientes?estado=borrado',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(badEstado.statusCode).toBe(400);
    expect(badEstado.json()).toEqual({
      error: 'invalid_query',
      message: 'Parámetros inválidos',
    });

    const unknownKey = await app.inject({
      method: 'GET',
      url: '/api/pacientes?q=&institution_kind=hospital_general',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(unknownKey.statusCode).toBe(400);
    expect((unknownKey.json() as ErrorDto).error).toBe('invalid_query');

    const badId = await app.inject({
      method: 'GET',
      url: '/api/pacientes/0',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(badId.statusCode).toBe(400);
    expect((badId.json() as ErrorDto).error).toBe('invalid_query');
  });

  it('auditor_write_and_medico_archive_are_forbidden', async () => {
    const hospital = createTestMemoryAdapterSet('hospital_general', 1);
    const pediatric = createTestMemoryAdapterSet('centro_pediatrico', 2);
    const auth = await authWithHospitalRoles();
    const app = buildHttpApp({ registry: clinicalRegistry(hospital, pediatric), auth });

    const adminToken = await loginAs(app, 'hospital@genki.local');
    const created = await app.inject({
      method: 'POST',
      url: '/api/pacientes',
      headers: { authorization: `Bearer ${adminToken}` },
      payload: adult('ROLE-1'),
    });
    const id = (created.json() as PacienteResumen).paciente.id_paciente;

    const auditorToken = await loginAs(app, 'auditor@genki.local');
    const auditorWrite = await app.inject({
      method: 'POST',
      url: `/api/pacientes/${id}/archivo`,
      headers: { authorization: `Bearer ${auditorToken}` },
      payload: { motivo_archivo: 'administrativo' },
    });
    expect(auditorWrite.statusCode).toBe(403);
    expect((auditorWrite.json() as ErrorDto).error).toBe('forbidden');

    const auditorRead = await app.inject({
      method: 'GET',
      url: `/api/pacientes/${id}`,
      headers: { authorization: `Bearer ${auditorToken}` },
    });
    expect(auditorRead.statusCode).toBe(200);

    const medicoToken = await loginAs(app, 'medico-h@genki.local');
    const medicoArchive = await app.inject({
      method: 'POST',
      url: `/api/pacientes/${id}/archivo`,
      headers: { authorization: `Bearer ${medicoToken}` },
      payload: { motivo_archivo: 'administrativo' },
    });
    expect(medicoArchive.statusCode).toBe(403);
    expect((medicoArchive.json() as ErrorDto).error).toBe('forbidden');
  });

  it('close_http_returns_complete_bundle', async () => {
    const hospital = createTestMemoryAdapterSet('hospital_general', 1);
    const pediatric = createTestMemoryAdapterSet('centro_pediatrico', 2);
    seedHospitalCatalogs(hospital);
    const auth = await authWithHospitalRoles();
    const app = buildHttpApp({ registry: clinicalRegistry(hospital, pediatric), auth });
    const adminToken = await loginAs(app, 'hospital@genki.local');

    const created = await app.inject({
      method: 'POST',
      url: '/api/pacientes',
      headers: { authorization: `Bearer ${adminToken}` },
      payload: adult('CLOSE-HTTP-1'),
    });
    expect(created.statusCode).toBe(201);
    const id = (created.json() as PacienteResumen).paciente.id_paciente;

    const medicoToken = await loginAs(app, 'medico-h@genki.local');
    const closed = await app.inject({
      method: 'POST',
      url: `/api/pacientes/${id}/consultas`,
      headers: { authorization: `Bearer ${medicoToken}` },
      payload: closeBody(),
    });
    expect(closed.statusCode).toBe(201);
    const body = closed.json() as {
      consulta: { estado: string; id_cita: number | null };
      diagnosticos: unknown[];
      tratamientos: unknown[];
      receta: { folio: string } | null;
      detalles: unknown[];
    };
    expect(body.consulta.estado).toBe('cerrada');
    expect(body.consulta.id_cita).toBeNull();
    expect(body.diagnosticos.length).toBeGreaterThanOrEqual(1);
    expect(body.tratamientos.length).toBeGreaterThanOrEqual(1);
    expect(body.receta).not.toBeNull();
    expect(body.receta?.folio).toMatch(/^REC-/);
    expect(body.detalles.length).toBeGreaterThanOrEqual(1);
  });

  it('recepcion_cannot_close_consulta', async () => {
    const hospital = createTestMemoryAdapterSet('hospital_general', 1);
    const pediatric = createTestMemoryAdapterSet('centro_pediatrico', 2);
    seedHospitalCatalogs(hospital);
    const auth = await authWithHospitalRoles();
    const app = buildHttpApp({ registry: clinicalRegistry(hospital, pediatric), auth });
    const adminToken = await loginAs(app, 'hospital@genki.local');

    const created = await app.inject({
      method: 'POST',
      url: '/api/pacientes',
      headers: { authorization: `Bearer ${adminToken}` },
      payload: adult('CLOSE-HTTP-2'),
    });
    expect(created.statusCode).toBe(201);
    const id = (created.json() as PacienteResumen).paciente.id_paciente;

    const recepcionToken = await loginAs(app, 'recepcion@genki.local');
    const denied = await app.inject({
      method: 'POST',
      url: `/api/pacientes/${id}/consultas`,
      headers: { authorization: `Bearer ${recepcionToken}` },
      payload: closeBody(),
    });
    expect(denied.statusCode).toBe(403);
    expect((denied.json() as ErrorDto).error).toBe('forbidden');
    expect(hospital.memoryState.getPublished().consultas.size).toBe(0);
  });

  it('superadmin_selected_institution_passes_clinical_role_and_recepcion_still_forbidden', async () => {
    const hospital = createTestMemoryAdapterSet('hospital_general', 1);
    const pediatric = createTestMemoryAdapterSet('centro_pediatrico', 2);
    seedHospitalCatalogs(hospital);
    const auth = await authWithHospitalRoles();
    const app = buildHttpApp({ registry: clinicalRegistry(hospital, pediatric), auth });
    const { password } = testCredentials();

    const adminToken = await loginAs(app, 'hospital@genki.local');
    const created = await app.inject({
      method: 'POST',
      url: '/api/pacientes',
      headers: { authorization: `Bearer ${adminToken}` },
      payload: adult('SUPER-ALG-1'),
    });
    expect(created.statusCode).toBe(201);
    const id = (created.json() as PacienteResumen).paciente.id_paciente;

    const login = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: {
        email: 'superadmin@example.invalid',
        password,
        institution_kind: 'hospital_general',
      },
    });
    expect(login.statusCode).toBe(200);
    const homeTokens = login.json() as AuthTokensDto;

    const away = await app.inject({
      method: 'POST',
      url: '/api/auth/select-institution',
      headers: { authorization: `Bearer ${homeTokens.access_token}` },
      payload: {
        institution_kind: 'laboratorio_clinico',
        refresh_token: homeTokens.refresh_token,
      },
    });
    expect(away.statusCode).toBe(200);
    const labTokens = away.json() as AuthTokensDto;

    const back = await app.inject({
      method: 'POST',
      url: '/api/auth/select-institution',
      headers: { authorization: `Bearer ${labTokens.access_token}` },
      payload: {
        institution_kind: 'hospital_general',
        refresh_token: labTokens.refresh_token,
      },
    });
    expect(back.statusCode).toBe(200);
    const active = back.json() as AuthTokensDto;

    const allowed = await app.inject({
      method: 'POST',
      url: `/api/pacientes/${id}/alergias`,
      headers: {
        authorization: `Bearer ${active.access_token}`,
        'idempotency-key': 'superadmin-alergia-1',
      },
      payload: {
        sustancia: 'Penicilina',
        tipo: 'medicamento',
        severidad: 'moderada',
        reaccion: 'Urticaria',
        fecha_deteccion: '2020-03-15',
      },
    });
    expect(allowed.statusCode).toBe(201);

    const recepcionToken = await loginAs(app, 'recepcion@genki.local');
    const denied = await app.inject({
      method: 'POST',
      url: `/api/pacientes/${id}/alergias`,
      headers: {
        authorization: `Bearer ${recepcionToken}`,
        'idempotency-key': 'recepcion-alergia-1',
      },
      payload: {
        sustancia: 'Ibuprofeno',
        tipo: 'medicamento',
        severidad: 'leve',
        reaccion: null,
        fecha_deteccion: null,
      },
    });
    expect(denied.statusCode).toBe(403);
    expect((denied.json() as ErrorDto).error).toBe('forbidden');
  });

  it('superadmin_selected_institution_passes_agenda_and_charges_unauthorized_forbidden', async () => {
    const hospital = createTestMemoryAdapterSet('hospital_general', 1);
    const pediatric = createTestMemoryAdapterSet('centro_pediatrico', 2);
    seedHospitalCatalogs(hospital);
    const auth = await authWithHospitalRoles();
    const app = buildHttpApp({ registry: clinicalRegistry(hospital, pediatric), auth });
    const { password } = testCredentials();

    const login = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: {
        email: 'superadmin@example.invalid',
        password,
        institution_kind: 'hospital_general',
      },
    });
    expect(login.statusCode).toBe(200);
    const homeTokens = login.json() as AuthTokensDto;

    const selected = await app.inject({
      method: 'POST',
      url: '/api/auth/select-institution',
      headers: { authorization: `Bearer ${homeTokens.access_token}` },
      payload: {
        institution_kind: 'hospital_general',
        refresh_token: homeTokens.refresh_token,
      },
    });
    expect(selected.statusCode).toBe(200);
    const active = selected.json() as AuthTokensDto;

    const agenda = await app.inject({
      method: 'GET',
      url: '/api/agenda?fecha=2026-11-09',
      headers: { authorization: `Bearer ${active.access_token}` },
    });
    expect(agenda.statusCode).toBe(200);
    expect(Array.isArray(agenda.json())).toBe(true);

    const tarifario = await app.inject({
      method: 'GET',
      url: '/api/tarifario',
      headers: { authorization: `Bearer ${active.access_token}` },
    });
    expect(tarifario.statusCode).toBe(200);
    expect((tarifario.json() as { items: unknown[] }).items).toEqual([]);

    const disponibilidad = await app.inject({
      method: 'GET',
      url: '/api/agenda/disponibilidad?id_profesional=1&desde=2026-11-09T14:00:00.000Z&hasta=2026-11-09T23:00:00.000Z',
      headers: { authorization: `Bearer ${active.access_token}` },
    });
    expect(disponibilidad.statusCode).toBe(200);
    expect(Array.isArray(disponibilidad.json())).toBe(true);

    const insumos = await app.inject({
      method: 'GET',
      url: '/api/insumos',
      headers: { authorization: `Bearer ${active.access_token}` },
    });
    expect(insumos.statusCode).toBe(200);
    expect(typeof (insumos.json() as { total: number }).total).toBe('number');

    const demos = await buildDemoUsers(password);
    const hash = demos[0]!.hash_contrasena;
    const lockedAuth = await createPhase0Auth(testCredentials().jwtSecret, [
      ...demos,
      {
        id_usuario: 13,
        email: 'laboratorista@genki.local',
        hash_contrasena: hash,
        id_institucion: 1,
        institution_kind: 'hospital_general',
        roles: ['laboratorista'],
        estado: 'activo',
      },
    ]);
    const lockedApp = buildHttpApp({
      registry: clinicalRegistry(hospital, pediatric),
      auth: lockedAuth,
    });
    const deniedToken = await loginAs(lockedApp, 'laboratorista@genki.local');
    const deniedAgenda = await lockedApp.inject({
      method: 'GET',
      url: '/api/agenda?fecha=2026-11-09',
      headers: { authorization: `Bearer ${deniedToken}` },
    });
    expect(deniedAgenda.statusCode).toBe(403);
    expect((deniedAgenda.json() as ErrorDto).error).toBe('forbidden');
    const deniedTarifario = await lockedApp.inject({
      method: 'GET',
      url: '/api/tarifario',
      headers: { authorization: `Bearer ${deniedToken}` },
    });
    expect(deniedTarifario.statusCode).toBe(403);
    expect((deniedTarifario.json() as ErrorDto).error).toBe('forbidden');
  });

  it('op37_and_fs19_routes_accept_superadmin_on_institution_engines', async () => {
    const hospital = createTestMemoryAdapterSet('hospital_general', 1);
    const pediatric = createTestMemoryAdapterSet('centro_pediatrico', 2);
    const dentalSet = createTestMemoryAdapterSet('clinica_odontologica', 4);
    seedHospitalCatalogs(hospital);
    seedHospitalCatalogs(dentalSet);
    const auth = await authWithHospitalRoles();
    const app = buildHttpApp({
      registry: clinicalRegistry(hospital, pediatric, dentalSet),
      auth,
    });
    const { password } = testCredentials();

    const login = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: {
        email: 'superadmin@example.invalid',
        password,
        institution_kind: 'hospital_general',
      },
    });
    expect(login.statusCode).toBe(200);
    const home = login.json() as AuthTokensDto;

    const procedure = await app.inject({
      method: 'POST',
      url: '/api/procedimientos',
      headers: {
        authorization: `Bearer ${home.access_token}`,
        'idempotency-key': 'op37-http-1',
      },
      payload: {
        id_consulta: 1,
        codigo_procedimiento: 'PROC-DEMO',
        id_profesional: 1,
        fecha_hora: '2026-11-09T15:00:00.000Z',
        equipo: [],
        consumos: [],
      },
    });
    expect(procedure.statusCode).toBe(201);
    expect((procedure.json() as { id_procedimiento: number }).id_procedimiento).toBeGreaterThan(0);

    const dentalSelect = await app.inject({
      method: 'POST',
      url: '/api/auth/select-institution',
      headers: { authorization: `Bearer ${home.access_token}` },
      payload: {
        institution_kind: 'clinica_odontologica',
        refresh_token: home.refresh_token,
      },
    });
    expect(dentalSelect.statusCode).toBe(200);
    const dental = dentalSelect.json() as AuthTokensDto;

    const saldo = await app.inject({
      method: 'GET',
      url: '/api/pacientes/1/saldo-dental',
      headers: { authorization: `Bearer ${dental.access_token}` },
    });
    expect(saldo.statusCode).toBe(404);
    expect((saldo.json() as ErrorDto).error).toBe('not_found');

    const sessionMissing = await app.inject({
      method: 'POST',
      url: '/api/planes/99/sesiones',
      headers: {
        authorization: `Bearer ${dental.access_token}`,
        'idempotency-key': 'op59-http-1',
      },
      payload: {
        fecha: '2026-11-09',
        lineas: [1],
        expected_revision: 0,
      },
    });
    expect(sessionMissing.statusCode).toBe(404);
    expect((sessionMissing.json() as ErrorDto).error).toBe('not_found');

    const registered = await app.inject({
      method: 'POST',
      url: '/api/pacientes',
      headers: { authorization: `Bearer ${dental.access_token}` },
      payload: adult('DENTAL-SES-1', 'Dina'),
    });
    expect(registered.statusCode).toBe(201);
    const patientId = (registered.json() as PacienteResumen).paciente.id_paciente;

    const plan = await app.inject({
      method: 'POST',
      url: `/api/pacientes/${patientId}/planes`,
      headers: {
        authorization: `Bearer ${dental.access_token}`,
        'idempotency-key': 'op57-http-1',
      },
      payload: {
        id_profesional: 1,
        detalle: [
          {
            linea: 1,
            numero_pieza: 11,
            codigo_procedimiento: 'RESINA',
            orden: 1,
            precio_unitario: '150.00',
          },
        ],
      },
    });
    expect(plan.statusCode).toBe(201);
    const planId = (plan.json() as { id_plan: number }).id_plan;

    const accepted = await app.inject({
      method: 'POST',
      url: `/api/planes/${planId}/aceptacion`,
      headers: {
        authorization: `Bearer ${dental.access_token}`,
        'idempotency-key': 'op58-http-1',
      },
    });
    expect(accepted.statusCode).toBe(200);

    const session = await app.inject({
      method: 'POST',
      url: `/api/planes/${planId}/sesiones`,
      headers: {
        authorization: `Bearer ${dental.access_token}`,
        'idempotency-key': 'op59-http-ok',
      },
      payload: {
        fecha: '2026-11-09',
        lineas: [1],
        expected_revision: 0,
      },
    });
    expect(session.statusCode).toBe(201);
    expect((session.json() as { id_sesion: number }).id_sesion).toBeGreaterThan(0);
  });
});

describe('HTTP account users lane3', () => {
  it('op03_change_password', async () => {
    const { password } = testCredentials();
    const identity = await identityWithHospitalRoles();
    const hospital = createTestMemoryAdapterSet('hospital_general', 1);
    const pediatric = createTestMemoryAdapterSet('centro_pediatrico', 2);
    const app = buildHttpApp({
      registry: clinicalRegistry(hospital, pediatric),
      auth: identity.auth,
      account: identity.account,
      users: identity.users,
    });
    const first = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: {
        email: 'hospital@genki.local',
        password,
        institution_kind: 'hospital_general',
      },
    });
    expect(first.statusCode).toBe(200);
    const tokens = first.json() as AuthTokensDto;
    const nueva = `${password}Xtra9`;
    const wrong = await app.inject({
      method: 'POST',
      url: '/api/auth/password',
      headers: { authorization: `Bearer ${tokens.access_token}` },
      payload: { anterior: 'no-es-la-clave', nueva },
    });
    expect(wrong.statusCode).toBe(401);
    expect((wrong.json() as ErrorDto).error).toBe('invalid_credentials');
    const weak = await app.inject({
      method: 'POST',
      url: '/api/auth/password',
      headers: { authorization: `Bearer ${tokens.access_token}` },
      payload: { anterior: password, nueva: 'corta1' },
    });
    expect(weak.statusCode).toBe(400);
    expect((weak.json() as ErrorDto).error).toBe('password_policy');
    const changed = await app.inject({
      method: 'POST',
      url: '/api/auth/password',
      headers: { authorization: `Bearer ${tokens.access_token}` },
      payload: { anterior: password, nueva },
    });
    expect(changed.statusCode).toBe(204);
    const refresh = await app.inject({
      method: 'POST',
      url: '/api/auth/refresh',
      payload: { refresh_token: tokens.refresh_token },
    });
    expect(refresh.statusCode).toBe(401);

    const oldLogin = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: {
        email: 'hospital@genki.local',
        password,
        institution_kind: 'hospital_general',
      },
    });
    expect(oldLogin.statusCode).toBe(401);

    const newLogin = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: {
        email: 'hospital@genki.local',
        password: nueva,
        institution_kind: 'hospital_general',
      },
    });
    expect(newLogin.statusCode).toBe(200);
  });

  it('op05_create_user', async () => {
    const identity = await identityWithHospitalRoles();
    const hospital = createTestMemoryAdapterSet('hospital_general', 1);
    const pediatric = createTestMemoryAdapterSet('centro_pediatrico', 2);
    const app = buildHttpApp({
      registry: clinicalRegistry(hospital, pediatric),
      auth: identity.auth,
      account: identity.account,
      users: identity.users,
    });
    const token = await loginAs(app, 'hospital@genki.local');
    const rejectedRole = await app.inject({
      method: 'POST',
      url: '/api/usuarios',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        action: 'create',
        nombre_usuario: 'root',
        correo: 'root@genki.local',
        rol: 'superadministrador',
      },
    });
    expect(rejectedRole.statusCode).toBe(400);
    const lastAdmin = await app.inject({
      method: 'POST',
      url: '/api/usuarios',
      headers: { authorization: `Bearer ${token}` },
      payload: { action: 'deactivate', id: 1 },
    });
    expect(lastAdmin.statusCode).toBe(409);
    expect((lastAdmin.json() as ErrorDto).error).toBe('conflict');
    const created = await app.inject({
      method: 'POST',
      url: '/api/usuarios',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        action: 'create',
        nombre_usuario: 'nuevo_recepcion',
        correo: 'nuevo-recepcion@genki.local',
        rol: 'recepcion',
      },
    });
    expect(created.statusCode).toBe(200);
    const body = created.json() as {
      usuario: { correo: string; rol: string; estado: string };
      temporal: string;
    };
    expect(body.usuario.correo).toBe('nuevo-recepcion@genki.local');
    expect(body.usuario.rol).toBe('recepcion');
    expect(body.usuario.estado).toBe('activo');
    expect(body.temporal.length).toBe(24);
    expect(JSON.stringify(body)).not.toContain('hash_contrasena');
    const audit = await app.inject({
      method: 'GET',
      url: '/api/bitacora',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(audit.statusCode).toBe(200);
    const auditText = JSON.stringify(audit.json());
    expect(auditText).not.toContain(body.temporal);
    expect(auditText).toContain('"entidad":"usuario"');
    const asNew = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: {
        email: 'nuevo-recepcion@genki.local',
        password: body.temporal,
        institution_kind: 'hospital_general',
      },
    });
    expect(asNew.statusCode).toBe(200);
    const recepcion = await loginAs(app, 'recepcion@genki.local');
    const denied = await app.inject({
      method: 'POST',
      url: '/api/usuarios',
      headers: { authorization: `Bearer ${recepcion}` },
      payload: {
        action: 'create',
        nombre_usuario: 'otro',
        correo: 'otro@genki.local',
        rol: 'medico',
      },
    });
    expect(denied.statusCode).toBe(403);
  });
});

/** Regression tests for transport/validation hardening (QA round 2026-11-09). */

async function makeHardeningApp() {
  const { password, jwtSecret } = testCredentials();
  const demos = await buildDemoUsers(password);
  const users: IdentityUser[] = [
    ...demos,
    {
      id_usuario: 12,
      email: 'medico-h@genki.local',
      hash_contrasena: demos[0]!.hash_contrasena,
      id_institucion: 1,
      institution_kind: 'hospital_general',
      roles: ['medico'],
      estado: 'activo',
    },
  ];
  const identity = await createPhase0Identity(jwtSecret, users);
  const hospital = createTestMemoryAdapterSet('hospital_general', 1);
  const registry = new InstitutionAdapterRegistry();
  registry.register('hospital_general', () => hospital);
  registry.register('centro_pediatrico', () => createTestMemoryAdapterSet('centro_pediatrico', 2));
  registry.register('laboratorio_clinico', () =>
    createTestMemoryAdapterSet('laboratorio_clinico', 3),
  );
  registry.register('clinica_odontologica', () =>
    createTestMemoryAdapterSet('clinica_odontologica', 4),
  );
  const app = buildHttpApp({
    registry,
    auth: identity.auth,
    account: identity.account,
    users: identity.users,
  });
  return { app, hospital };
}

type HardeningApp = Awaited<ReturnType<typeof makeHardeningApp>>['app'];

async function hardeningToken(app: HardeningApp, email = 'hospital@genki.local'): Promise<string> {
  const { password } = testCredentials();
  const res = await app.inject({
    method: 'POST',
    url: '/api/auth/login',
    payload: { email, password, institution_kind: 'hospital_general' },
  });
  expect(res.statusCode).toBe(200);
  return (res.json() as AuthTokensDto).access_token;
}

function hardeningPatient(
  fecha_nacimiento: string,
  numero_documento = 'HARD-1',
): RegisterPacienteRequest {
  return {
    tipo_documento: 'DPI',
    numero_documento,
    primer_nombre: 'Ana',
    primer_apellido: 'Lopez',
    fecha_nacimiento,
    sexo: 'F',
  };
}

const PDF_BASE64 = Buffer.from('%PDF-1.4\n%%EOF\n').toString('base64');

describe('transport errors never surface as 500', () => {
  it('malformed JSON on login is 400 invalid_body', async () => {
    const { app } = await makeHardeningApp();
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      headers: { 'content-type': 'application/json' },
      payload: '{"a":',
    });
    expect(res.statusCode).toBe(400);
    expect(res.json()).toEqual({ error: 'invalid_body', message: 'Solicitud inválida' });
  });

  it('empty JSON body is 400 invalid_body', async () => {
    const { app } = await makeHardeningApp();
    const auth = { authorization: `Bearer ${await hardeningToken(app)}` };
    const res = await app.inject({
      method: 'POST',
      url: '/api/pacientes',
      headers: { ...auth, 'content-type': 'application/json' },
      payload: '',
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error).toBe('invalid_body');
  });

  it('unsupported media types are 415, including multipart', async () => {
    const { app } = await makeHardeningApp();
    const xml = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      headers: { 'content-type': 'application/xml' },
      payload: '<a/>',
    });
    expect(xml.statusCode).toBe(415);
    expect(xml.json().error).toBe('unsupported_media_type');

    const auth = { authorization: `Bearer ${await hardeningToken(app, 'medico-h@genki.local')}` };
    const multipart = await app.inject({
      method: 'POST',
      url: '/api/pacientes/1/documentos',
      headers: {
        ...auth,
        'idempotency-key': 'exe-1',
        'content-type': 'multipart/form-data; boundary=x',
      },
      payload:
        '--x\r\nContent-Disposition: form-data; name="archivo"; filename="a.exe"\r\n' +
        'Content-Type: application/x-msdownload\r\n\r\nMZ\r\n--x--\r\n',
    });
    expect(multipart.statusCode).toBe(415);
    expect(multipart.json().error).toBe('unsupported_media_type');
  });

  it('a body over the global limit is 413 payload_too_large', async () => {
    const { app } = await makeHardeningApp();
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      headers: { 'content-type': 'application/json' },
      payload: JSON.stringify({ x: 'a'.repeat(1_100_000) }),
    });
    expect(res.statusCode).toBe(413);
    expect(res.json()).toEqual({
      error: 'payload_too_large',
      message: 'La solicitud excede el tamaño permitido',
    });
  });

  it('the documentos route has its own larger limit sized for base64 of 10 MiB', async () => {
    expect(DOCUMENT_BODY_LIMIT_BYTES).toBeGreaterThan(Math.ceil((10 * 1024 * 1024 * 4) / 3));
    const { app } = await makeHardeningApp();
    const auth = { authorization: `Bearer ${await hardeningToken(app, 'medico-h@genki.local')}` };
    const bigButAllowed = await app.inject({
      method: 'POST',
      url: '/api/pacientes/1/documentos',
      headers: { ...auth, 'content-type': 'application/json', 'idempotency-key': 'big-1' },
      payload: JSON.stringify({
        archivo_base64: Buffer.from('%PDF' + '0'.repeat(1_000_000)).toString('base64'),
        tipo_mime: 'application/pdf',
      }),
    });
    expect(bigButAllowed.statusCode).not.toBe(413);
    const tooBig = await app.inject({
      method: 'POST',
      url: '/api/pacientes/1/documentos',
      headers: { ...auth, 'content-type': 'application/json', 'idempotency-key': 'big-2' },
      payload: JSON.stringify({ archivo_base64: 'A'.repeat(DOCUMENT_BODY_LIMIT_BYTES + 10) }),
    });
    expect(tooBig.statusCode).toBe(413);
  });
});

describe('documentos JSON contract', () => {
  it('accepts archivo_base64 without nombre_archivo and rejects non-whitelisted input', async () => {
    const { app } = await makeHardeningApp();
    const admin = { authorization: `Bearer ${await hardeningToken(app)}` };
    const created = await app.inject({
      method: 'POST',
      url: '/api/pacientes',
      headers: admin,
      payload: hardeningPatient('1990-01-15', 'DOC-1'),
    });
    expect(created.statusCode).toBe(201);
    const id = (created.json() as { paciente: { id_paciente: number } }).paciente.id_paciente;
    const medico = { authorization: `Bearer ${await hardeningToken(app, 'medico-h@genki.local')}` };
    const post = (key: string, payload: unknown) =>
      app.inject({
        method: 'POST',
        url: `/api/pacientes/${id}/documentos`,
        headers: { ...medico, 'idempotency-key': key },
        payload: payload as Record<string, unknown>,
      });

    const ok = await post('doc-ok', { archivo_base64: PDF_BASE64, tipo_mime: 'application/pdf' });
    expect(ok.statusCode).toBe(201);
    expect(ok.json().tipo_mime).toBe('application/pdf');

    const dataUrl = await post('doc-data-url', {
      archivo_base64: `data:application/pdf;base64,${PDF_BASE64}`,
      nombre_archivo: 'informe.pdf',
    });
    expect(dataUrl.statusCode).toBe(201);

    const exe = await post('doc-exe', {
      archivo_base64: Buffer.from('MZ\x90\x00').toString('base64'),
      tipo_mime: 'application/x-msdownload',
      nombre_archivo: 'a.exe',
    });
    expect(exe.statusCode).toBe(400);

    const notBase64 = await post('doc-b64', {
      archivo_base64: '!!no',
      tipo_mime: 'application/pdf',
    });
    expect(notBase64.statusCode).toBe(400);

    const unknownKey = await post('doc-key', {
      archivo_base64: PDF_BASE64,
      tipo_mime: 'application/pdf',
      ruta: '/etc/passwd',
    });
    expect(unknownKey.statusCode).toBe(400);
  });
});

describe('query and body validation', () => {
  it('bitácora rejects malformed or inverted date ranges with 400 invalid_query', async () => {
    const { app } = await makeHardeningApp();
    const auth = { authorization: `Bearer ${await hardeningToken(app)}` };
    for (const qs of [
      'desde=zzz',
      'hasta=2026-02-30',
      'desde=2026-11-09&hasta=2026-11-01',
      'desde=2026-11-01T25:00:00Z',
      'page_size=51',
      'page=0',
      `entidad=${'x'.repeat(200)}`,
    ]) {
      const res = await app.inject({ method: 'GET', url: `/api/bitacora?${qs}`, headers: auth });
      expect(res.statusCode, qs).toBe(400);
      expect(res.json().error, qs).toBe('invalid_query');
    }
    const ok = await app.inject({
      method: 'GET',
      url: '/api/bitacora?desde=2026-11-01&hasta=2026-11-10T23:59:59Z',
      headers: auth,
    });
    expect(ok.statusCode).toBe(200);
  });

  it('patient registration rejects a future birth date', async () => {
    const { app, hospital } = await makeHardeningApp();
    const auth = { authorization: `Bearer ${await hardeningToken(app)}` };
    const res = await app.inject({
      method: 'POST',
      url: '/api/pacientes',
      headers: auth,
      payload: hardeningPatient('2099-01-01'),
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error).toBe('invalid_body');
    await expect(
      registerPaciente(hospital.pacientes, hardeningPatient('2099-01-01', 'HARD-2')),
    ).rejects.toMatchObject({ code: 'invalid_body' });
    const ok = await app.inject({
      method: 'POST',
      url: '/api/pacientes',
      headers: auth,
      payload: hardeningPatient('1990-01-15', 'HARD-3'),
    });
    expect(ok.statusCode).toBe(201);
  });

  it('login answers a generic 401 for a short wrong password', async () => {
    const { app } = await makeHardeningApp();
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: {
        email: 'hospital@genki.local',
        password: 'abc',
        institution_kind: 'hospital_general',
      },
    });
    expect(res.statusCode).toBe(401);
    expect(res.json().error).toBe('invalid_credentials');
  });

  it('honorarios with an empty body is 400 invalid_body, not 409', async () => {
    const { app } = await makeHardeningApp();
    const auth = { authorization: `Bearer ${await hardeningToken(app)}` };
    for (const payload of [{}, { id_consulta: 1, id_procedimiento: 1 }]) {
      const res = await app.inject({
        method: 'POST',
        url: '/api/actos/honorarios',
        headers: auth,
        payload,
      });
      expect(res.statusCode).toBe(400);
      expect(res.json().error).toBe('invalid_body');
    }
  });
});

import { describe, expect, it } from 'vitest';
import type {
  AuthPrincipalDto,
  AuthTokensDto,
  CloseConsultaRequest,
  ErrorDto,
  HistorialDto,
  InstitutionKind,
  PacientePage,
  PacienteResumen,
  RegisterPacienteRequest,
} from '@genki/shared';
import {
  ACCESS_TOKEN_TTL_SECONDS,
  asInstitutionId,
  asUsuarioId,
  engineForKind,
} from '@genki/shared';
import { closeConsulta } from '../../application/close-consulta.js';
import { InstitutionAdapterRegistry } from '../../config/adapter-registry.js';
import { createPhase0Auth, createPhase0Registry } from '../../config/compose-memory.js';
import {
  createTestMemoryAdapterSet,
  type TestMemoryAdapterSet,
} from '../../config/memory-test-factory.js';
import { AuthError, type AuthPort } from '../../ports/auth.js';
import {
  SEED_CIE10,
  SEED_MEDICAMENTO_1,
  SEED_PROFESIONAL_ID,
  expectedPrimaryCatalog,
} from '../../testing/catalog-seeds.js';
import { buildHttpApp } from './app.js';

const JWT_SECRET = 'test-secret-at-least-16';

interface TestAuthUser {
  id_usuario: number;
  email: string;
  password: string;
  id_institucion: number;
  institution_kind: InstitutionKind;
  roles: string[];
}

/** Test-only AuthPort. Keeps http tests off memory adapters (depcruise). */
class TestAuthPort implements AuthPort {
  constructor(private readonly users: TestAuthUser[]) {}

  async login(input: {
    email: string;
    password: string;
    institution_kind: InstitutionKind;
  }): Promise<AuthTokensDto> {
    const user = this.users.find(
      (row) =>
        row.email === input.email &&
        row.password === input.password &&
        row.institution_kind === input.institution_kind,
    );
    if (!user) {
      throw new AuthError('Invalid email, password, or institution', 'invalid_credentials');
    }
    const principal: AuthPrincipalDto = {
      id_usuario: asUsuarioId(user.id_usuario),
      email: user.email,
      id_institucion: asInstitutionId(user.id_institucion),
      institution_kind: user.institution_kind,
      roles: [...user.roles],
      motor: engineForKind(user.institution_kind),
    };
    return {
      access_token: Buffer.from(JSON.stringify(principal), 'utf8').toString('base64url'),
      refresh_token: 'test-refresh',
      token_type: 'Bearer',
      expires_in: ACCESS_TOKEN_TTL_SECONDS,
    };
  }

  async refresh(_refreshToken: string): Promise<AuthTokensDto> {
    throw new AuthError('Invalid refresh token', 'invalid_token');
  }

  async verifyAccessToken(accessToken: string): Promise<AuthPrincipalDto> {
    try {
      const raw = Buffer.from(accessToken, 'base64url').toString('utf8');
      return JSON.parse(raw) as AuthPrincipalDto;
    } catch {
      throw new AuthError('Invalid access token', 'invalid_token');
    }
  }
}

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

function authWithHospitalRoles(): AuthPort {
  return new TestAuthPort([
    {
      id_usuario: 1,
      email: 'hospital@genki.local',
      password: 'GenkiDev1',
      id_institucion: 1,
      institution_kind: 'hospital_general',
      roles: ['administrador'],
    },
    {
      id_usuario: 2,
      email: 'pediatrico@genki.local',
      password: 'GenkiDev1',
      id_institucion: 2,
      institution_kind: 'centro_pediatrico',
      roles: ['medico'],
    },
    {
      id_usuario: 10,
      email: 'auditor@genki.local',
      password: 'GenkiDev1',
      id_institucion: 1,
      institution_kind: 'hospital_general',
      roles: ['auditor'],
    },
    {
      id_usuario: 11,
      email: 'recepcion@genki.local',
      password: 'GenkiDev1',
      id_institucion: 1,
      institution_kind: 'hospital_general',
      roles: ['recepcion'],
    },
    {
      id_usuario: 12,
      email: 'medico-h@genki.local',
      password: 'GenkiDev1',
      id_institucion: 1,
      institution_kind: 'hospital_general',
      roles: ['medico'],
    },
  ]);
}

function clinicalRegistry(hospital: TestMemoryAdapterSet, pediatric: TestMemoryAdapterSet) {
  const registry = new InstitutionAdapterRegistry();
  registry.register('hospital_general', () => hospital);
  registry.register('centro_pediatrico', () => pediatric);
  registry.register('laboratorio_clinico', () =>
    createTestMemoryAdapterSet('laboratorio_clinico', 3),
  );
  registry.register('clinica_odontologica', () =>
    createTestMemoryAdapterSet('clinica_odontologica', 4),
  );
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
  const login = await app.inject({
    method: 'POST',
    url: '/api/auth/login',
    payload: { email, password: 'GenkiDev1', institution_kind },
  });
  expect(login.statusCode).toBe(200);
  return (login.json() as AuthTokensDto).access_token;
}

describe('HTTP auth routing', () => {
  it('returns tokens from login and routes pacientes via JWT institution', async () => {
    const auth = await createPhase0Auth(JWT_SECRET);
    const app = buildHttpApp({ registry: createPhase0Registry(), auth });

    const login = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: {
        email: 'hospital@genki.local',
        password: 'GenkiDev1',
        institution_kind: 'hospital_general',
      },
    });
    expect(login.statusCode).toBe(200);
    const tokens = login.json() as { access_token: string };

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
  });
});

describe('HTTP patient search detail catalog archive', () => {
  it('search_returns_only_active_by_default', async () => {
    const hospital = createTestMemoryAdapterSet('hospital_general', 1);
    const pediatric = createTestMemoryAdapterSet('centro_pediatrico', 2);
    seedHospitalCatalogs(hospital);
    const auth = authWithHospitalRoles();
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
    const auth = authWithHospitalRoles();
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
    const auth = authWithHospitalRoles();
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
    const auth = authWithHospitalRoles();
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

  it('reactivate_route_absent', async () => {
    const hospital = createTestMemoryAdapterSet('hospital_general', 1);
    const pediatric = createTestMemoryAdapterSet('centro_pediatrico', 2);
    const auth = authWithHospitalRoles();
    const app = buildHttpApp({ registry: clinicalRegistry(hospital, pediatric), auth });
    const token = await loginAs(app, 'hospital@genki.local');

    const created = await app.inject({
      method: 'POST',
      url: '/api/pacientes',
      headers: { authorization: `Bearer ${token}` },
      payload: adult('REACT-1'),
    });
    const id = (created.json() as PacienteResumen).paciente.id_paciente;
    await app.inject({
      method: 'POST',
      url: `/api/pacientes/${id}/archivo`,
      headers: { authorization: `Bearer ${token}` },
      payload: { motivo_archivo: 'inactividad' },
    });

    for (const method of ['POST', 'PUT', 'PATCH'] as const) {
      const missing = await app.inject({
        method,
        url: `/api/pacientes/${id}/reactivacion`,
        headers: { authorization: `Bearer ${token}` },
        payload: {},
      });
      expect(missing.statusCode).toBe(404);
      expect(missing.json()).toEqual({
        error: 'not_found',
        message: 'Recurso no encontrado',
      });
    }
  });

  it('invalid_query_returns_safe_error', async () => {
    const hospital = createTestMemoryAdapterSet('hospital_general', 1);
    const pediatric = createTestMemoryAdapterSet('centro_pediatrico', 2);
    const auth = authWithHospitalRoles();
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
    const auth = authWithHospitalRoles();
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
});

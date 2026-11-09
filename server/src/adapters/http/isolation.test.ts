import { describe, expect, it } from 'vitest';
import { SignJWT } from 'jose';
import {
  ACCESS_TOKEN_TTL_SECONDS,
  ACCESS_TOKEN_TYP,
  asInstitutionId,
  type AuthTokensDto,
  type ErrorDto,
  type PacienteResumen,
  type RegisterPacienteRequest,
} from '@genki/shared';
import { createPhase0Auth, createPhase0Registry } from '../../config/compose-memory.js';
import { testCredentials } from '../../test/credentials.js';
import { buildHttpApp } from './app.js';

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

function pediatricRegister(numero_documento: string): RegisterPacienteRequest {
  return {
    ...adult(numero_documento, 'Luis'),
    fecha_nacimiento: '2018-05-01',
    responsables: [
      {
        tipo_documento: 'DPI',
        numero_documento: `G-${numero_documento}`,
        nombre_completo: 'Tutor Principal',
        parentesco: 'madre',
        telefono: '5555-0000',
        es_principal: true,
      },
    ],
  };
}

async function loginAs(
  app: ReturnType<typeof buildHttpApp>,
  email: string,
  institution_kind: 'hospital_general' | 'centro_pediatrico' = 'hospital_general',
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

describe('HTTP API isolation', () => {
  it('two_logins_route_to_disjoint_persistent_memory_sets', async () => {
    const registry = createPhase0Registry();
    const { jwtSecret } = testCredentials();
    const auth = await createPhase0Auth(jwtSecret);
    const app = buildHttpApp({ registry, auth });

    const hospitalToken = await loginAs(app, 'hospital@genki.local');
    const pediatricToken = await loginAs(app, 'pediatrico@genki.local', 'centro_pediatrico');

    const sharedDoc = 'ISO-DOC-1';
    const hospitalCreate = await app.inject({
      method: 'POST',
      url: '/api/pacientes',
      headers: { authorization: `Bearer ${hospitalToken}` },
      payload: adult(sharedDoc, 'Hospital'),
    });
    expect(hospitalCreate.statusCode).toBe(201);
    const hospitalId = (hospitalCreate.json() as PacienteResumen).paciente.id_paciente;

    const pediatricSet = registry.resolve('centro_pediatrico', asInstitutionId(2));
    const pediatricCreated = await pediatricSet.pacientes.createWithExpediente(
      pediatricRegister(sharedDoc),
    );
    const pediatricId = pediatricCreated.paciente.id_paciente;

    const hospitalReread = await app.inject({
      method: 'GET',
      url: `/api/pacientes/${hospitalId}`,
      headers: { authorization: `Bearer ${hospitalToken}` },
    });
    expect(hospitalReread.statusCode).toBe(200);
    expect(
      (hospitalReread.json() as { paciente: { primer_nombre: string } }).paciente.primer_nombre,
    ).toBe('Hospital');

    const hospitalAtPediatricId = await app.inject({
      method: 'GET',
      url: `/api/pacientes/${pediatricId}`,
      headers: { authorization: `Bearer ${hospitalToken}` },
    });
    if (hospitalId === pediatricId) {
      expect(hospitalAtPediatricId.statusCode).toBe(200);
      expect(
        (hospitalAtPediatricId.json() as { paciente: { primer_nombre: string } }).paciente
          .primer_nombre,
      ).toBe('Hospital');
    } else {
      expect(hospitalAtPediatricId.statusCode).toBe(404);
      expect(hospitalAtPediatricId.json()).toEqual({
        error: 'not_found',
        message: 'Recurso no encontrado',
      });
    }

    const pediatricAtHospitalId = await app.inject({
      method: 'GET',
      url: `/api/pacientes/${hospitalId}`,
      headers: { authorization: `Bearer ${pediatricToken}` },
    });
    if (hospitalId === pediatricId) {
      expect(pediatricAtHospitalId.statusCode).toBe(200);
      expect(
        (pediatricAtHospitalId.json() as { paciente: { primer_nombre: string } }).paciente
          .primer_nombre,
      ).toBe('Luis');
    } else {
      expect(pediatricAtHospitalId.statusCode).toBe(404);
    }

    const hospitalSearch = await app.inject({
      method: 'GET',
      url: `/api/pacientes?q=${sharedDoc}`,
      headers: { authorization: `Bearer ${hospitalToken}` },
    });
    expect(hospitalSearch.statusCode).toBe(200);
    const hospitalItems = (
      hospitalSearch.json() as { items: { paciente: { primer_nombre: string } }[] }
    ).items;
    expect(hospitalItems.length).toBeGreaterThanOrEqual(1);
    expect(hospitalItems.every((row) => row.paciente.primer_nombre === 'Hospital')).toBe(true);

    const pediatricSearch = await app.inject({
      method: 'GET',
      url: `/api/pacientes?q=${sharedDoc}`,
      headers: { authorization: `Bearer ${pediatricToken}` },
    });
    expect(pediatricSearch.statusCode).toBe(200);
    const pediatricItems = (
      pediatricSearch.json() as { items: { paciente: { primer_nombre: string } }[] }
    ).items;
    expect(pediatricItems.length).toBeGreaterThanOrEqual(1);
    expect(pediatricItems.every((row) => row.paciente.primer_nombre === 'Luis')).toBe(true);

    const hospitalSetA = registry.resolve('hospital_general', asInstitutionId(1));
    const hospitalSetB = registry.resolve('hospital_general', asInstitutionId(1));
    expect(hospitalSetA).toBe(hospitalSetB);
    expect(await hospitalSetA.pacientes.findById(hospitalId)).not.toBeNull();
  });

  it('forged_motor_and_unknown_kind_rejected', async () => {
    const registry = createPhase0Registry();
    const { jwtSecret } = testCredentials();
    const auth = await createPhase0Auth(jwtSecret);
    const app = buildHttpApp({ registry, auth });
    const now = Math.floor(Date.now() / 1000);
    const secret = new TextEncoder().encode(jwtSecret);

    const forgedMotor = await new SignJWT({
      email: 'hospital@genki.local',
      institucion_id: 1,
      institucion_kind: 'hospital_general',
      roles: ['administrador'],
      motor: 'mysql',
      typ: ACCESS_TOKEN_TYP,
    })
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject('1')
      .setIssuedAt(now)
      .setExpirationTime(now + ACCESS_TOKEN_TTL_SECONDS)
      .sign(secret);

    const forgedMotorMe = await app.inject({
      method: 'GET',
      url: '/api/auth/me',
      headers: { authorization: `Bearer ${forgedMotor}` },
    });
    expect(forgedMotorMe.statusCode).toBe(401);
    expect((forgedMotorMe.json() as ErrorDto).error).toBe('invalid_token');

    const unknownKind = await new SignJWT({
      email: 'hospital@genki.local',
      institucion_id: 1,
      institucion_kind: 'hospital_fantasma',
      roles: ['administrador'],
      motor: 'postgres',
      typ: ACCESS_TOKEN_TYP,
    })
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject('1')
      .setIssuedAt(now)
      .setExpirationTime(now + ACCESS_TOKEN_TTL_SECONDS)
      .sign(secret);

    const unknownKindMe = await app.inject({
      method: 'GET',
      url: '/api/auth/me',
      headers: { authorization: `Bearer ${unknownKind}` },
    });
    expect(unknownKindMe.statusCode).toBe(401);
    expect((unknownKindMe.json() as ErrorDto).error).toBe('invalid_token');
  });

  it('archive_and_read_keep_same_instance', async () => {
    const registry = createPhase0Registry();
    const { jwtSecret } = testCredentials();
    const auth = await createPhase0Auth(jwtSecret);
    const app = buildHttpApp({ registry, auth });
    const token = await loginAs(app, 'hospital@genki.local');

    const before = registry.resolve('hospital_general', asInstitutionId(1));
    const created = await app.inject({
      method: 'POST',
      url: '/api/pacientes',
      headers: { authorization: `Bearer ${token}` },
      payload: adult('ISO-ARCH-1'),
    });
    expect(created.statusCode).toBe(201);
    const resumen = created.json() as PacienteResumen;
    const id = resumen.paciente.id_paciente;
    const expedienteId = resumen.expediente.id_expediente;

    const archived = await app.inject({
      method: 'POST',
      url: `/api/pacientes/${id}/archivo`,
      headers: { authorization: `Bearer ${token}` },
      payload: { motivo_archivo: 'traslado' },
    });
    expect(archived.statusCode).toBe(200);

    const after = registry.resolve('hospital_general', asInstitutionId(1));
    expect(after).toBe(before);
    const expediente = await after.pacientes.findExpedienteById(expedienteId);
    expect(expediente?.estado).toBe('archivado');

    const detail = await app.inject({
      method: 'GET',
      url: `/api/pacientes/${id}`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(detail.statusCode).toBe(200);
  });

  it('coverage_exercises_error_paths', async () => {
    const registry = createPhase0Registry();
    const { jwtSecret } = testCredentials();
    const auth = await createPhase0Auth(jwtSecret);
    const app = buildHttpApp({ registry, auth });

    const adminToken = await loginAs(app, 'hospital@genki.local');
    const created = await app.inject({
      method: 'POST',
      url: '/api/pacientes',
      headers: { authorization: `Bearer ${adminToken}` },
      payload: adult('ISO-ERR-1'),
    });
    expect(created.statusCode).toBe(201);
    const id = (created.json() as PacienteResumen).paciente.id_paciente;

    const medicoToken = await loginAs(app, 'pediatrico@genki.local', 'centro_pediatrico');
    const forbiddenArchive = await app.inject({
      method: 'POST',
      url: `/api/pacientes/${id}/archivo`,
      headers: { authorization: `Bearer ${medicoToken}` },
      payload: { motivo_archivo: 'administrativo' },
    });
    expect(forbiddenArchive.statusCode).toBe(403);
    expect((forbiddenArchive.json() as ErrorDto).error).toBe('forbidden');

    const crossRead = await app.inject({
      method: 'GET',
      url: `/api/pacientes/${id}`,
      headers: { authorization: `Bearer ${medicoToken}` },
    });
    expect(crossRead.statusCode).toBe(404);
    expect((crossRead.json() as ErrorDto).error).toBe('not_found');
  });
});

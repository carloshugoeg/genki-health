import * as argon2 from 'argon2';
import { describe, expect, it } from 'vitest';
import type { AuthTokensDto, HistorialDto, RegisterPacienteRequest } from '@genki/shared';
import { InstitutionAdapterRegistry } from '../../config/adapter-registry.js';
import { createPhase0Identity } from '../../config/compose-memory.js';
import {
  createTestMemoryAdapterSet,
  type TestMemoryAdapterSet,
} from '../../config/memory-test-factory.js';
import type { IdentityUser } from '../../ports/identity-store.js';
import { testCredentials } from '../../test/credentials.js';
import { buildHttpApp } from './app.js';

/** Linked professional deliberately != 1 to prove attribution is not a constant. */
const MEDICO_PROFESIONAL = 7;

function seedCatalogs(set: TestMemoryAdapterSet): void {
  const catalogs = set.memoryState.getPublished().catalogs;
  catalogs.profesionales.set(1, {
    id_profesional: 1,
    nombres: 'Uno',
    apellidos: 'A',
    activo: true,
  });
  catalogs.profesionales.set(MEDICO_PROFESIONAL, {
    id_profesional: MEDICO_PROFESIONAL,
    nombres: 'Siete',
    apellidos: 'B',
    activo: true,
  });
  catalogs.medicamentos.set(1, { id_medicamento: 1, nombre_generico: 'Med A', activo: true });
  catalogs.cie10.set('Z00.0', { codigo_cie10: 'Z00.0', descripcion: 'Examen general' });
}

async function setup() {
  const { password, jwtSecret } = testCredentials();
  const hash = await argon2.hash(password, { type: argon2.argon2id });
  const base = { hash_contrasena: hash, estado: 'activo' as const };
  const users: Array<IdentityUser & { id_profesional?: number | null }> = [
    {
      ...base,
      id_usuario: 1,
      email: 'hospital@genki.local',
      id_institucion: 1,
      institution_kind: 'hospital_general',
      roles: ['administrador'],
    },
    {
      ...base,
      id_usuario: 20,
      email: 'medico-cm@genki.local',
      id_institucion: 1,
      institution_kind: 'hospital_general',
      roles: ['medico'],
      id_profesional: MEDICO_PROFESIONAL,
    },
    {
      ...base,
      id_usuario: 21,
      email: 'medico-sin-vinculo@genki.local',
      id_institucion: 1,
      institution_kind: 'hospital_general',
      roles: ['medico'],
    },
    {
      ...base,
      id_usuario: 22,
      email: 'recepcion-cm@genki.local',
      id_institucion: 1,
      institution_kind: 'hospital_general',
      roles: ['recepcion'],
    },
  ];
  const identity = await createPhase0Identity(jwtSecret, users);
  const hospital = createTestMemoryAdapterSet('hospital_general', 1);
  seedCatalogs(hospital);
  const registry = new InstitutionAdapterRegistry();
  registry.register('hospital_general', () => hospital);
  registry.register('centro_pediatrico', () => createTestMemoryAdapterSet('centro_pediatrico', 2));
  registry.register('laboratorio_clinico', () =>
    createTestMemoryAdapterSet('laboratorio_clinico', 3),
  );
  registry.register('clinica_odontologica', () =>
    createTestMemoryAdapterSet('clinica_odontologica', 4),
  );
  const app = buildHttpApp({ registry, auth: identity.auth, users: identity.users });
  const login = async (email: string) => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email, password, institution_kind: 'hospital_general' },
    });
    expect(res.statusCode).toBe(200);
    return { authorization: `Bearer ${(res.json() as AuthTokensDto).access_token}` };
  };
  return { app, login, hospital };
}

function adult(numero_documento: string): RegisterPacienteRequest {
  return {
    tipo_documento: 'DPI',
    numero_documento,
    primer_nombre: 'Clara',
    primer_apellido: 'Lopez',
    fecha_nacimiento: '1990-01-15',
    sexo: 'F',
  };
}

const today = () => new Date().toISOString().slice(0, 10);

function cierreBody(withReceta = true) {
  return {
    plan: 'Reposo',
    diagnosticos: [
      { codigo_cie10: 'Z00.0', descripcion: 'Control', tipo: 'presuntivo', es_principal: true },
    ],
    tratamientos: [
      {
        diagnostico_index: 0,
        tipo: 'reposo',
        descripcion: 'Reposo',
        fecha_inicio: today(),
        estado: 'activo',
      },
    ],
    ...(withReceta
      ? {
          receta: {
            detalles: [
              {
                id_medicamento: 1,
                dosis: '500 mg',
                via_administracion: 'oral',
                frecuencia_horas: 8,
                duracion_dias: 3,
                cantidad: 9,
              },
            ],
          },
        }
      : {}),
  };
}

async function openConsulta(
  ctx: Awaited<ReturnType<typeof setup>>,
  doc: string,
  medico = 'medico-cm@genki.local',
  body: Record<string, unknown> = {},
) {
  const admin = await ctx.login('hospital@genki.local');
  const reg = await ctx.app.inject({
    method: 'POST',
    url: '/api/pacientes',
    headers: admin,
    payload: adult(doc),
  });
  expect(reg.statusCode).toBe(201);
  const id_paciente = (reg.json() as { paciente: { id_paciente: number } }).paciente.id_paciente;
  const headers = { ...(await ctx.login(medico)), 'idempotency-key': `open-${doc}` };
  const open = await ctx.app.inject({
    method: 'POST',
    url: `/api/pacientes/${id_paciente}/consultas/abiertas`,
    headers,
    payload: {
      tipo: 'primera_vez',
      motivo_consulta: 'Dolor',
      fecha_hora_inicio: new Date(Date.now() - 60_000).toISOString(),
      ...body,
    },
  });
  return { id_paciente, admin, open };
}

describe('clinical maintenance HTTP (memory adapters)', () => {
  it('attributes an open consultation to the user USUARIO.id_profesional, not a constant', async () => {
    const ctx = await setup();
    const { open } = await openConsulta(ctx, 'CM-ATTR');
    expect(open.statusCode).toBe(201);
    const draft = open.json() as { consulta: { id_profesional: number; estado: string } };
    expect(draft.consulta.id_profesional).toBe(MEDICO_PROFESIONAL);
    expect(draft.consulta.estado).toBe('abierta');

    const foreign = await openConsulta(ctx, 'CM-ATTR-2', 'medico-cm@genki.local', {
      id_profesional: 1,
    });
    expect(foreign.open.statusCode).toBe(403);

    const unlinked = await openConsulta(ctx, 'CM-ATTR-3', 'medico-sin-vinculo@genki.local');
    expect(unlinked.open.statusCode).toBe(403);
    expect((unlinked.open.json() as { message: string }).message).toMatch(/profesional vinculado/);
  });

  it('blocks archive with consulta_abierta, closes atomically, then archive succeeds', async () => {
    const ctx = await setup();
    const { id_paciente, admin, open } = await openConsulta(ctx, 'CM-CLOSE');
    const id_consulta = (open.json() as { consulta: { id_consulta: number } }).consulta.id_consulta;

    const blocked = await ctx.app.inject({
      method: 'POST',
      url: `/api/pacientes/${id_paciente}/archivo`,
      headers: admin,
      payload: { motivo_archivo: 'administrativo' },
    });
    expect(blocked.statusCode).toBe(409);
    expect(blocked.json()).toEqual({
      error: 'consulta_abierta',
      message: 'El paciente tiene una consulta abierta; ciérrela antes de archivar el expediente',
    });

    const medico = await ctx.login('medico-cm@genki.local');
    const invalid = await ctx.app.inject({
      method: 'POST',
      url: `/api/consultas/${id_consulta}/cierre`,
      headers: medico,
      payload: { ...cierreBody(), diagnosticos: [] },
    });
    expect(invalid.statusCode).toBe(400);

    const closed = await ctx.app.inject({
      method: 'POST',
      url: `/api/consultas/${id_consulta}/cierre`,
      headers: medico,
      payload: cierreBody(),
    });
    expect(closed.statusCode).toBe(200);
    const completa = closed.json() as {
      consulta: { estado: string; fecha_hora_fin: string | null; plan: string };
      diagnosticos: unknown[];
      tratamientos: unknown[];
      receta: { estado: string; id_profesional: number } | null;
    };
    expect(completa.consulta.estado).toBe('cerrada');
    expect(completa.consulta.fecha_hora_fin).not.toBeNull();
    expect(completa.diagnosticos).toHaveLength(1);
    expect(completa.tratamientos).toHaveLength(1);
    expect(completa.receta?.estado).toBe('emitida');
    expect(completa.receta?.id_profesional).toBe(MEDICO_PROFESIONAL);

    const again = await ctx.app.inject({
      method: 'POST',
      url: `/api/consultas/${id_consulta}/cierre`,
      headers: medico,
      payload: cierreBody(),
    });
    expect(again.statusCode).toBe(409);

    const historial = await ctx.app.inject({
      method: 'GET',
      url: `/api/pacientes/${id_paciente}`,
      headers: medico,
    });
    const h = historial.json() as HistorialDto;
    expect(h.consultas[0]!.consulta.estado).toBe('cerrada');
    expect(h.consultas[0]!.diagnosticos).toHaveLength(1);

    const archived = await ctx.app.inject({
      method: 'POST',
      url: `/api/pacientes/${id_paciente}/archivo`,
      headers: admin,
      payload: { motivo_archivo: 'administrativo' },
    });
    expect(archived.statusCode).toBe(200);
  });

  it('rolls back the whole close when a medication is unknown', async () => {
    const ctx = await setup();
    const { id_paciente, open } = await openConsulta(ctx, 'CM-ROLLBACK');
    const id_consulta = (open.json() as { consulta: { id_consulta: number } }).consulta.id_consulta;
    const medico = await ctx.login('medico-cm@genki.local');
    const body = cierreBody();
    body.receta!.detalles[0]!.id_medicamento = 999;
    const res = await ctx.app.inject({
      method: 'POST',
      url: `/api/consultas/${id_consulta}/cierre`,
      headers: medico,
      payload: body,
    });
    expect(res.statusCode).toBe(422);
    const h = (
      await ctx.app.inject({ method: 'GET', url: `/api/pacientes/${id_paciente}`, headers: medico })
    ).json() as HistorialDto;
    expect(h.consultas[0]!.consulta.estado).toBe('abierta');
    expect(h.consultas[0]!.diagnosticos).toHaveLength(0);
  });

  it('edits and annuls diagnosis, treatment and prescription with audit, clinical roles only', async () => {
    const ctx = await setup();
    const { open } = await openConsulta(ctx, 'CM-AMEND');
    const id_consulta = (open.json() as { consulta: { id_consulta: number } }).consulta.id_consulta;
    const medico = await ctx.login('medico-cm@genki.local');
    const closed = (
      await ctx.app.inject({
        method: 'POST',
        url: `/api/consultas/${id_consulta}/cierre`,
        headers: medico,
        payload: cierreBody(),
      })
    ).json() as {
      diagnosticos: { id_diagnostico: number }[];
      tratamientos: { id_tratamiento: number }[];
      receta: { id_receta: number };
    };
    const dx = closed.diagnosticos[0]!.id_diagnostico;
    const tx = closed.tratamientos[0]!.id_tratamiento;
    const rx = closed.receta.id_receta;
    const call = (method: 'PATCH' | 'POST', url: string, payload: unknown, headers = medico) =>
      ctx.app.inject({ method, url, headers, payload: payload as Record<string, unknown> });

    const dxEdit = await call('PATCH', `/api/diagnosticos/${dx}`, {
      tipo: 'definitivo',
      motivo: 'Confirmado',
    });
    expect(dxEdit.statusCode).toBe(200);
    expect(dxEdit.json()).toMatchObject({ entidad: 'diagnostico', item: { tipo: 'definitivo' } });

    const txEdit = await call('PATCH', `/api/tratamientos/${tx}`, {
      estado: 'finalizado',
      motivo: 'Alta',
    });
    expect(txEdit.statusCode).toBe(200);
    expect(txEdit.json()).toMatchObject({ item: { estado: 'finalizado' } });
    expect(
      (await call('PATCH', `/api/tratamientos/${tx}`, { estado: 'finalizado', motivo: 'x' }))
        .statusCode,
    ).toBe(409);

    const rxAnnul = await call('POST', `/api/recetas/${rx}/anulacion`, { motivo: 'Error' });
    expect(rxAnnul.statusCode).toBe(200);
    expect(rxAnnul.json()).toMatchObject({ item: { estado: 'anulada' } });
    expect((await call('POST', `/api/recetas/${rx}/anulacion`, { motivo: 'x' })).statusCode).toBe(
      409,
    );
    expect(
      (await call('PATCH', `/api/recetas/${rx}`, { observaciones: 'x', motivo: 'x' })).statusCode,
    ).toBe(409);

    const dxAnnul = await call('POST', `/api/diagnosticos/${dx}/anulacion`, {
      motivo: 'Descartado',
    });
    expect(dxAnnul.json()).toMatchObject({ item: { tipo: 'descartado' } });
    const txAnnul = await call('POST', `/api/tratamientos/${tx}/anulacion`, {
      motivo: 'Suspendido',
    });
    expect(txAnnul.json()).toMatchObject({ item: { estado: 'suspendido' } });

    expect(
      (await call('PATCH', `/api/diagnosticos/${dx}`, { tipo: 'descartado', motivo: 'x' }))
        .statusCode,
    ).toBe(400);
    expect((await call('POST', `/api/diagnosticos/${dx}/anulacion`, {})).statusCode).toBe(400);
    expect(
      (await call('POST', '/api/tratamientos/99999/anulacion', { motivo: 'x' })).statusCode,
    ).toBe(404);
    const recepcion = await ctx.login('recepcion-cm@genki.local');
    expect(
      (await call('POST', `/api/tratamientos/${tx}/anulacion`, { motivo: 'x' }, recepcion))
        .statusCode,
    ).toBe(403);

    // Rows are never deleted; history still lists them with their terminal status.
    const bitacora = ctx.hospital.memoryState
      .getPublished()
      .extensions.get('consultation')
      ?.get('bitacora');
    const rows = [...(bitacora?.values() ?? [])] as Array<{
      entidad: string;
      id_usuario: number;
      detalle: { operacion: string; motivo: string | null };
    }>;
    expect(rows.map((r) => `${r.entidad}:${r.detalle.operacion}`)).toEqual([
      'consulta:cierre',
      'diagnostico:modificacion',
      'tratamiento:modificacion',
      'receta:anulacion',
      'diagnostico:anulacion',
      'tratamiento:anulacion',
    ]);
    expect(rows.every((r) => r.id_usuario === 20)).toBe(true);
  });
});

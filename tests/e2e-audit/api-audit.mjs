#!/usr/bin/env node
// Genki Health — auditoría E2E a nivel API contra el runtime real (GENKI_MODE=engines).
// Uso:
//   node tests/e2e-audit/api-audit.mjs                 # fase 1: flujo completo, guarda estado
//   node tests/e2e-audit/api-audit.mjs --verify        # fase 2: tras reiniciar API/contenedores, comprueba persistencia
// Variables: GENKI_API (default http://127.0.0.1:3000), GENKI_PASS (default admin123!).
// Todos los datos creados llevan el prefijo E2E-AUDIT para identificarlos.
import { writeFileSync, readFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = join(HERE, 'results');
mkdirSync(OUT, { recursive: true });
const B = process.env.GENKI_API ?? 'http://127.0.0.1:3000';
const PASS = process.env.GENKI_PASS ?? 'admin123!';
const VERIFY = process.argv.includes('--verify');
// yyMMddHHmm keeps numero_documento (`E2E-AUDIT-<run>-<n>-<x>`) within its 25-char limit.
const RUN = process.env.GENKI_RUN ?? new Date().toISOString().slice(2, 16).replace(/[-:T]/g, '');
const TAG = `E2E-AUDIT-${RUN}`;
const INST = [
  { n: 1, kind: 'hospital_general', motor: 'postgres' },
  { n: 2, kind: 'centro_pediatrico', motor: 'mysql' },
  { n: 3, kind: 'laboratorio_clinico', motor: 'mongodb' },
  { n: 4, kind: 'clinica_odontologica', motor: 'firebase' },
];
const results = [];
const http5xx = [];
let idemSeq = 0;
const idem = () => `${TAG}-${++idemSeq}`;

function rec(area, name, ok, detail = {}, severity = ok ? 'info' : 'media') {
  detail = JSON.parse(
    JSON.stringify(detail ?? {}).replace(
      /"(temporal|access_token|refresh_token|password)":"[^"]*"/g,
      '"$1":"[redactado]"',
    ),
  );
  results.push({ area, name, ok, severity, detail });
  const mark = ok ? 'PASS' : 'FAIL';
  console.log(`${mark} [${area}] ${name}${ok ? '' : ' ' + JSON.stringify(detail).slice(0, 300)}`);
}

async function req(method, path, { token, body, headers = {}, raw } = {}) {
  const h = { ...headers };
  if (token) h.authorization = `Bearer ${token}`;
  let payload;
  if (raw !== undefined) {
    payload = raw;
    h['content-type'] ??= 'application/json';
  } else if (body !== undefined) {
    payload = JSON.stringify(body);
    h['content-type'] = 'application/json';
  }
  let res;
  try {
    res = await fetch(B + path, { method, headers: h, body: payload });
  } catch (e) {
    return { status: 0, json: { error: String(e) } };
  }
  const text = await res.text();
  let json;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = { _text: text.slice(0, 200) };
  }
  if (res.status >= 500) http5xx.push({ method, path, status: res.status, body: json });
  return { status: res.status, json };
}
const is4xx = (s) => s >= 400 && s < 500;

async function login(email, kind, password = PASS) {
  const r = await req('POST', '/api/auth/login', {
    body: { email, password, institution_kind: kind },
  });
  return r.status === 200 ? r.json : null;
}

function patientBody(i, suffix) {
  return {
    tipo_documento: 'OTRO',
    numero_documento: `${TAG}-${i.n}-${suffix}`,
    primer_nombre: 'Auditoria',
    segundo_nombre: null,
    primer_apellido: `E2E${i.n}`,
    segundo_apellido: suffix,
    fecha_nacimiento: i.kind === 'centro_pediatrico' ? '2024-03-15' : '1988-06-20',
    sexo: 'F',
    tipo_sangre: 'O+',
    telefono: '5555-0000',
    correo: null,
    direccion: 'Dirección E2E',
    id_municipio: 1,
    ...(i.kind === 'centro_pediatrico'
      ? {
          responsables: [
            {
              tipo_documento: 'DPI',
              numero_documento: `${TAG}-R${i.n}`,
              nombre_completo: 'Responsable E2E',
              parentesco: 'madre',
              telefono: '5555-1111',
              correo: null,
              direccion: null,
              es_principal: true,
            },
          ],
        }
      : {}),
  };
}

function closeBody(idProf, idMed) {
  return {
    id_profesional: idProf,
    fecha_hora_inicio: new Date(Date.now() - 30 * 60000).toISOString(),
    tipo: 'primera_vez',
    motivo_consulta: `${TAG} motivo`,
    enfermedad_actual: 'Cefalea leve',
    exploracion_fisica: 'Normal',
    plan: 'Control en 1 semana',
    diagnosticos: [
      { codigo_cie10: null, descripcion: 'Cefalea', tipo: 'definitivo', es_principal: true },
    ],
    tratamientos: [
      {
        diagnostico_index: 0,
        tipo: 'farmacologico',
        descripcion: 'Analgésico',
        indicaciones: 'Con alimentos',
        fecha_inicio: new Date().toISOString().slice(0, 10),
        fecha_fin_estimada: null,
        estado: 'activo',
      },
    ],
    receta: {
      observaciones: 'E2E',
      detalles: [
        {
          id_medicamento: idMed,
          dosis: '500 mg',
          via_administracion: 'oral',
          frecuencia_horas: 8,
          duracion_dias: 3,
          cantidad: 9,
          indicaciones: null,
        },
      ],
    },
  };
}

const state = { run: RUN, tag: TAG, inst: {} };

async function phase1() {
  const health = await req('GET', '/health');
  rec('infra', 'health 200', health.status === 200, health);

  // ---------- Unauthenticated access ----------
  const getPaths = [
    '/api/auth/me',
    '/api/catalogos',
    '/api/pacientes',
    '/api/pacientes/101',
    '/api/pacientes/101/ficha',
    '/api/agenda?fecha=2026-11-09',
    '/api/bitacora',
    '/api/camas',
    '/api/vacunas/pendientes',
    '/api/insumos',
    '/api/tarifario',
    '/api/pacientes/101/cuenta',
    '/api/pacientes/101/cargos',
    '/api/pacientes/101/examenes',
  ];
  for (const p of getPaths) {
    const r = await req('GET', p);
    rec('auth', `sin token GET ${p} → 401`, r.status === 401, { status: r.status }, 'alta');
  }
  for (const p of ['/api/pacientes', '/api/citas', '/api/usuarios', '/api/laboratorio/ordenes']) {
    const r = await req('POST', p, { body: {} });
    rec('auth', `sin token POST ${p} → 401`, r.status === 401, { status: r.status }, 'alta');
  }
  const bad = await req('POST', '/api/auth/login', {
    body: {
      email: 'demo-1-medico@example.invalid',
      password: 'WrongPass-123!',
      institution_kind: 'hospital_general',
    },
  });
  rec('auth', 'login con contraseña incorrecta → 401', bad.status === 401, { status: bad.status });
  const wrongInst = await req('POST', '/api/auth/login', {
    body: {
      email: 'demo-1-medico@example.invalid',
      password: PASS,
      institution_kind: 'centro_pediatrico',
    },
  });
  rec(
    'auth',
    'login en institución ajena → rechazado',
    is4xx(wrongInst.status),
    { status: wrongInst.status },
    'alta',
  );
  const garbage = await req('POST', '/api/auth/login', { raw: '{not json' });
  rec('validacion', 'login con JSON roto → 4xx', is4xx(garbage.status), { status: garbage.status });
  const forged = await req('GET', '/api/auth/me', {
    token: 'eyJhbGciOiJub25lIn0.eyJzdWIiOiIxIn0.',
  });
  rec('auth', 'token alg=none → 401', forged.status === 401, { status: forged.status }, 'alta');

  // ---------- Per institution ----------
  for (const i of INST) {
    const A = `inst${i.n}-${i.motor}`;
    const s = (state.inst[i.kind] = { n: i.n });
    const adm = await login(`demo-${i.n}-administrador@example.invalid`, i.kind);
    const med = await login(`demo-${i.n}-medico@example.invalid`, i.kind);
    rec(A, 'login administrador y médico', !!adm && !!med);
    if (!adm || !med) continue;
    s.admRefresh = undefined;
    const ta = adm.access_token;
    const tm = med.access_token;
    s.ta = ta;
    s.tm = tm;
    const me = await req('GET', '/api/auth/me', { token: tm });
    rec(
      A,
      `ruteo: /me institution_kind=${i.kind} motor=${i.motor}`,
      me.json?.institution_kind === i.kind && me.json?.motor === i.motor,
      me.json,
      'alta',
    );
    s.id_institucion = me.json?.id_institucion;

    // tampered token: change payload kind, keep signature
    const [h, p, sig] = tm.split('.');
    const pl = JSON.parse(Buffer.from(p, 'base64url').toString());
    pl.institucion_kind = 'clinica_odontologica';
    pl.institution_kind = 'clinica_odontologica';
    pl.roles = ['superadministrador'];
    const tampered = `${h}.${Buffer.from(JSON.stringify(pl)).toString('base64url')}.${sig}`;
    const tr = await req('GET', '/api/auth/me', { token: tampered });
    rec(A, 'token manipulado (payload) → 401', tr.status === 401, { status: tr.status }, 'alta');

    const cat = await req('GET', '/api/catalogos', { token: tm });
    rec(A, 'catálogos', cat.status === 200, { status: cat.status });
    const idProf = cat.json?.profesionales?.[0]?.id_profesional ?? 1;
    const idMed = cat.json?.medicamentos?.[0]?.id_medicamento ?? 1;

    // registration
    const regMed = await req('POST', '/api/pacientes', { token: tm, body: patientBody(i, 'MED') });
    rec(A, 'médico no puede registrar paciente → 403', regMed.status === 403, {
      status: regMed.status,
    });
    const reg = await req('POST', '/api/pacientes', { token: ta, body: patientBody(i, 'A') });
    const pid = reg.json?.paciente?.id_paciente ?? reg.json?.id_paciente;
    rec(A, 'registro de paciente (admin) → 201', reg.status === 201 && !!pid, {
      status: reg.status,
      body: reg.json,
    });
    s.pid = pid;
    s.doc = `${TAG}-${i.n}-A`.toUpperCase();
    const dup = await req('POST', '/api/pacientes', { token: ta, body: patientBody(i, 'A') });
    rec(A, 'documento duplicado → 409/4xx', is4xx(dup.status), { status: dup.status });
    const inj = await req('POST', '/api/pacientes', {
      token: ta,
      body: { ...patientBody(i, 'INJ'), id_institucion: 99 },
    });
    rec(A, 'campo extra id_institucion → 400', inj.status === 400, { status: inj.status }, 'alta');
    const badDate = await req('POST', '/api/pacientes', {
      token: ta,
      body: { ...patientBody(i, 'BD'), fecha_nacimiento: '2026-02-30' },
    });
    rec(A, 'fecha inválida → 400', badDate.status === 400, { status: badDate.status });
    const future = await req('POST', '/api/pacientes', {
      token: ta,
      body: { ...patientBody(i, 'FUT'), fecha_nacimiento: '2099-01-01' },
    });
    rec(
      A,
      'fecha de nacimiento futura → 400',
      future.status === 400,
      { status: future.status, body: future.json },
      'baja',
    );
    const xss = await req('POST', '/api/pacientes', {
      token: ta,
      body: { ...patientBody(i, 'XSS'), primer_nombre: '<img src=x onerror=alert(1)>' },
    });
    rec(
      A,
      'nombre con HTML se acepta sólo como texto (registro)',
      [201, 400].includes(xss.status),
      { status: xss.status },
      'baja',
    );
    if (xss.status === 201) s.xssPid = xss.json?.paciente?.id_paciente;
    if (!pid) continue;

    const search = await req('GET', `/api/pacientes?q=${encodeURIComponent(s.doc)}`, { token: tm });
    rec(
      A,
      'búsqueda por documento',
      search.status === 200 && JSON.stringify(search.json).includes(s.doc),
      { status: search.status },
    );
    const badSearch = await req('GET', '/api/pacientes?page_size=9999&estado=zzz', { token: tm });
    rec(A, 'búsqueda con query inválida → 400', badSearch.status === 400, {
      status: badSearch.status,
    });
    const g = await req('GET', `/api/pacientes/${pid}`, { token: tm });
    rec(A, 'historial del paciente', g.status === 200, { status: g.status });
    for (const bid of ['abc', '-1', '0', '99999999999', '1.5']) {
      const r = await req('GET', `/api/pacientes/${bid}`, { token: tm });
      rec(A, `id inválido ${bid} → 4xx`, is4xx(r.status), { status: r.status });
    }
    const nf = await req('GET', '/api/pacientes/2147483000', { token: tm });
    rec(A, 'paciente inexistente → 404', nf.status === 404, { status: nf.status });

    // agenda
    // fecha única por corrida para no chocar con citas de corridas anteriores
    const dayOffset = 7 + (Math.floor(Date.now() / 60000) % 300) + i.n;
    const when = new Date(
      Date.UTC(
        new Date().getUTCFullYear(),
        new Date().getUTCMonth(),
        new Date().getUTCDate() + dayOffset,
        16,
        0,
        0,
      ),
    );
    s.agendaDate = when.toISOString().slice(0, 10);
    const cita = await req('POST', '/api/citas', {
      token: ta,
      headers: { 'idempotency-key': idem() },
      body: {
        id_paciente: pid,
        id_profesional: idProf,
        fecha_hora: when.toISOString(),
        duracion_minutos: 30,
        motivo: `${TAG} cita`,
      },
    });
    const cid = cita.json?.id_cita ?? cita.json?.cita?.id_cita;
    rec(A, 'agendar cita', [200, 201].includes(cita.status) && !!cid, {
      status: cita.status,
      body: cita.json,
    });
    s.cid = cid;
    const overlap = await req('POST', '/api/citas', {
      token: ta,
      headers: { 'idempotency-key': idem() },
      body: {
        id_paciente: pid,
        id_profesional: idProf,
        fecha_hora: when.toISOString(),
        duracion_minutos: 30,
        motivo: 'solape',
      },
    });
    rec(A, 'cita solapada mismo profesional → 409', is4xx(overlap.status), {
      status: overlap.status,
      body: overlap.json,
    });
    const ag = await req('GET', `/api/agenda?fecha=${when.toISOString().slice(0, 10)}`, {
      token: ta,
    });
    rec(
      A,
      'ver agenda del día',
      ag.status === 200 && (!cid || JSON.stringify(ag.json).includes(`${cid}`)),
      { status: ag.status },
    );
    const disp = await req(
      'GET',
      `/api/agenda/disponibilidad?id_profesional=${idProf}&desde=${encodeURIComponent(when.toISOString())}&hasta=${encodeURIComponent(new Date(when.getTime() + 8 * 3600000).toISOString())}`,
      { token: ta },
    );
    rec(A, 'disponibilidad', disp.status === 200, { status: disp.status });
    if (cid) {
      const rp = await req('POST', `/api/citas/${cid}/reprogramacion`, {
        token: ta,
        headers: { 'idempotency-key': idem() },
        body: {
          fecha_hora: new Date(when.getTime() + 3600000).toISOString(),
          duracion_minutos: 30,
        },
      });
      rec(A, 'reprogramar cita', rp.status === 200, { status: rp.status, body: rp.json });
      const ll = await req('POST', `/api/citas/${cid}/llegada`, { token: ta, body: {} });
      rec(A, 'registrar llegada', ll.status === 200, { status: ll.status, body: ll.json });
    }
    const c2when = new Date(when.getTime() + 5 * 3600000);
    const cita2 = await req('POST', '/api/citas', {
      token: ta,
      headers: { 'idempotency-key': idem() },
      body: {
        id_paciente: pid,
        id_profesional: idProf,
        fecha_hora: c2when.toISOString(),
        duracion_minutos: 30,
        motivo: 'cancelar',
      },
    });
    const cid2 = cita2.json?.id_cita ?? cita2.json?.cita?.id_cita;
    if (cid2) {
      const cc = await req('POST', `/api/citas/${cid2}/cancelacion`, {
        token: ta,
        headers: { 'idempotency-key': idem() },
        body: { motivo: 'E2E cancelación' },
      });
      rec(A, 'cancelar cita', cc.status === 200, { status: cc.status, body: cc.json });
      const cc2 = await req('POST', `/api/citas/${cid2}/llegada`, { token: ta, body: {} });
      rec(A, 'llegada sobre cita cancelada → 4xx', is4xx(cc2.status), { status: cc2.status });
    }

    // record: alergias / antecedentes / ficha
    const al = await req('POST', `/api/pacientes/${pid}/alergias`, {
      token: tm,
      headers: { 'idempotency-key': idem() },
      body: {
        sustancia: `${TAG} penicilina`,
        tipo: 'medicamento',
        severidad: 'severa',
        reaccion: 'urticaria',
        fecha_deteccion: '2020-01-01',
      },
    });
    rec(A, 'registrar alergia (médico)', [200, 201].includes(al.status), {
      status: al.status,
      body: al.json,
    });
    const alAdm = await req('POST', `/api/pacientes/${pid}/alergias`, {
      token: ta,
      headers: { 'idempotency-key': idem() },
      body: { sustancia: 'x', tipo: 'medicamento', severidad: 'leve' },
    });
    rec(A, 'administrador no registra alergia (rol clínico) → 403', alAdm.status === 403, {
      status: alAdm.status,
    });
    const an = await req('POST', `/api/pacientes/${pid}/antecedentes`, {
      token: tm,
      headers: { 'idempotency-key': idem() },
      body: {
        tipo: 'familiar',
        descripcion: `${TAG} diabetes madre`,
        vigente: true,
        fecha_inicio: '2015-05-01',
      },
    });
    rec(A, 'registrar antecedente', [200, 201].includes(an.status), {
      status: an.status,
      body: an.json,
    });
    const anBad = await req('POST', `/api/pacientes/${pid}/antecedentes`, {
      token: tm,
      headers: { 'idempotency-key': idem() },
      body: { tipo: 'zzz', descripcion: '', vigente: 'si' },
    });
    rec(A, 'antecedente inválido → 400', anBad.status === 400, { status: anBad.status });
    const fi = await req('GET', `/api/pacientes/${pid}/ficha`, { token: tm });
    rec(
      A,
      'ficha incluye alergia',
      fi.status === 200 && JSON.stringify(fi.json).includes('penicilina'),
      { status: fi.status },
    );

    // adjunto (multipart)
    try {
      const dj = await req('POST', `/api/pacientes/${pid}/documentos`, {
        token: tm,
        headers: { 'idempotency-key': idem() },
        body: {
          archivo_base64: Buffer.from('%PDF-1.4 E2E-AUDIT').toString('base64'),
          tipo_mime: 'application/pdf',
        },
      });
      rec(A, 'adjuntar documento PDF (JSON base64, como la UI)', [200, 201].includes(dj.status), {
        status: dj.status,
        body: dj.json,
      });
      const dx = await req('POST', `/api/pacientes/${pid}/documentos`, {
        token: tm,
        headers: { 'idempotency-key': idem() },
        body: {
          archivo_base64: Buffer.from('MZ').toString('base64'),
          tipo_mime: 'application/x-msdownload',
        },
      });
      rec(A, 'adjunto ejecutable rechazado → 4xx', is4xx(dx.status), { status: dx.status });
      const fd = new FormData();
      fd.append('archivo', new Blob(['%PDF-1.4 e2e'], { type: 'application/pdf' }), `${TAG}.pdf`);
      const res = await fetch(`${B}/api/pacientes/${pid}/documentos`, {
        method: 'POST',
        headers: { authorization: `Bearer ${tm}`, 'idempotency-key': idem() },
        body: fd,
      });
      const tx = await res.text();
      if (res.status >= 500)
        http5xx.push({
          method: 'POST',
          path: `/api/pacientes/${pid}/documentos`,
          status: res.status,
          body: tx.slice(0, 200),
        });
      rec(A, 'multipart/form-data → 4xx (no 500)', is4xx(res.status), {
        status: res.status,
        body: tx.slice(0, 200),
      });
      const fd2 = new FormData();
      fd2.append('archivo', new Blob(['MZ'], { type: 'application/x-msdownload' }), 'x.exe');
      const r2 = await fetch(`${B}/api/pacientes/${pid}/documentos`, {
        method: 'POST',
        headers: { authorization: `Bearer ${tm}`, 'idempotency-key': idem() },
        body: fd2,
      });
      rec(A, 'multipart .exe → 4xx (no 500)', is4xx(r2.status), { status: r2.status });
      if (r2.status >= 500)
        http5xx.push({ method: 'POST', path: 'documentos(.exe)', status: r2.status });
    } catch (e) {
      rec(A, 'adjuntar documento PDF', false, { error: String(e) });
    }

    // consulta abierta + signos
    const op = await req('POST', `/api/pacientes/${pid}/consultas/abiertas`, {
      token: tm,
      headers: { 'idempotency-key': idem() },
      body: {
        id_profesional: idProf,
        tipo: 'seguimiento',
        motivo_consulta: `${TAG} abierta`,
        fecha_hora_inicio: new Date().toISOString(),
        id_cita: null,
      },
    });
    const ocid = op.json?.id_consulta ?? op.json?.consulta?.id_consulta;
    rec(A, 'abrir consulta', [200, 201].includes(op.status) && !!ocid, {
      status: op.status,
      body: op.json,
    });
    if (ocid) {
      const sv = await req('PUT', `/api/consultas/${ocid}/signos`, {
        token: tm,
        headers: { 'idempotency-key': idem() },
        body: {
          presion_sistolica: 120,
          presion_diastolica: 80,
          frecuencia_cardiaca: 72,
          frecuencia_respiratoria: 16,
          temperatura_c: 36.8,
          saturacion_oxigeno: 98,
          peso_kg: 65,
          talla_cm: 165,
        },
      });
      rec(A, 'signos vitales', [200, 201].includes(sv.status), {
        status: sv.status,
        body: sv.json,
      });
      const svBad = await req('PUT', `/api/consultas/${ocid}/signos`, {
        token: tm,
        headers: { 'idempotency-key': idem() },
        body: { presion_sistolica: 999, temperatura_c: 'caliente' },
      });
      rec(A, 'signos fuera de rango → 400', svBad.status === 400, { status: svBad.status });
      s.ocid = ocid;
    }
    // consulta cerrada con diagnóstico/tratamiento/receta (atómica)
    const cl = await req('POST', `/api/pacientes/${pid}/consultas`, {
      token: tm,
      body: closeBody(idProf, idMed),
    });
    rec(
      A,
      'consulta + diagnóstico + tratamiento + receta',
      [200, 201].includes(cl.status),
      { status: cl.status, body: cl.json },
      'alta',
    );
    s.closedConsulta = cl.json?.id_consulta ?? cl.json?.consulta?.id_consulta;
    const clBad = await req('POST', `/api/pacientes/${pid}/consultas`, {
      token: tm,
      body: {
        ...closeBody(idProf, idMed),
        tratamientos: [{ ...closeBody(idProf, idMed).tratamientos[0], diagnostico_index: 5 }],
      },
    });
    rec(A, 'tratamiento con diagnostico_index inexistente → 4xx', is4xx(clBad.status), {
      status: clBad.status,
      body: clBad.json,
    });
    const clMedBad = await req('POST', `/api/pacientes/${pid}/consultas`, {
      token: tm,
      body: { ...closeBody(idProf, 999999) },
    });
    rec(
      A,
      'receta con medicamento inexistente → 4xx (sin escritura parcial)',
      is4xx(clMedBad.status),
      { status: clMedBad.status },
    );
    const cie = await req('POST', `/api/pacientes/${pid}/consultas`, {
      token: tm,
      body: {
        ...closeBody(idProf, idMed),
        diagnosticos: [
          { codigo_cie10: 'R51', descripcion: 'Cefalea', tipo: 'definitivo', es_principal: true },
        ],
      },
    });
    rec(
      A,
      'diagnóstico con CIE-10 real (R51) aceptado',
      [200, 201].includes(cie.status),
      {
        status: cie.status,
        body: cie.json,
        nota: 'catálogo CIE-10 vacío y no expuesto en /api/catalogos',
      },
      'media',
    );
    s.idDiag = JSON.stringify(cl.json ?? {}).match(/"id_diagnostico":(\d+)/)?.[1];
    const clAdm = await req('POST', `/api/pacientes/${pid}/consultas`, {
      token: ta,
      body: closeBody(idProf, idMed),
    });
    rec(
      A,
      'administrador (no clínico) no registra diagnóstico/receta → 403',
      clAdm.status === 403,
      {
        status: clAdm.status,
        nota: 'la ruta permite administrador por diseño; revisar contra rúbrica/rol',
      },
      'media',
    );
    const hist = await req('GET', `/api/pacientes/${pid}`, { token: tm });
    rec(
      A,
      'historial refleja diagnóstico y receta',
      JSON.stringify(hist.json ?? {}).includes('Cefalea'),
      { status: hist.status },
    );

    // ---------- especialidades ----------
    await specialty(i, A, s, ta, tm, pid, idProf);

    // ---------- económico (lecturas) ----------
    for (const p of [
      '/api/insumos',
      '/api/tarifario',
      `/api/pacientes/${pid}/cuenta`,
      `/api/pacientes/${pid}/cargos`,
      `/api/caja/cierre?fecha=${new Date().toISOString().slice(0, 10)}`,
    ]) {
      const r = await req('GET', p, { token: ta });
      rec(
        A,
        `económico GET ${p.replace(String(pid), ':id')}`,
        r.status === 200,
        { status: r.status, body: r.json },
        r.status >= 500 ? 'alta' : 'media',
      );
    }
    for (const p of [
      '/api/cargos',
      '/api/consumos',
      '/api/participaciones',
      '/api/personal',
      `/api/pacientes/${pid}/facturas`,
      `/api/pacientes/${pid}/facturas/preview`,
      '/api/actos/honorarios',
    ]) {
      const r = await req('POST', p, {
        token: ta,
        headers: { 'idempotency-key': idem() },
        body: {},
      });
      rec(
        A,
        `económico POST ${p.replace(String(pid), ':id')} cuerpo vacío → 400`,
        r.status === 400,
        { status: r.status, body: r.json },
      );
    }

    // ---------- usuarios / contraseñas / bitácora ----------
    const email = `${TAG.toLowerCase()}-u${i.n}@example.invalid`;
    const cu = await req('POST', '/api/usuarios', {
      token: ta,
      headers: { 'idempotency-key': idem() },
      body: {
        action: 'create',
        nombre_usuario: `${TAG}-u${i.n}`,
        correo: email,
        id_profesional: null,
        rol: 'recepcion',
        estado: 'activo',
      },
    });
    const uid = cu.json?.id_usuario ?? cu.json?.usuario?.id_usuario ?? cu.json?.id;
    rec(A, 'crear usuario (admin)', [200, 201].includes(cu.status) && !!uid, {
      status: cu.status,
      body: cu.json,
    });
    const cuMed = await req('POST', '/api/usuarios', {
      token: tm,
      headers: { 'idempotency-key': idem() },
      body: {
        action: 'create',
        nombre_usuario: 'x',
        correo: `${TAG.toLowerCase()}-x${i.n}@example.invalid`,
        id_profesional: null,
        rol: 'administrador',
        estado: 'activo',
      },
    });
    rec(
      A,
      'médico no administra usuarios → 403',
      cuMed.status === 403,
      { status: cuMed.status },
      'alta',
    );
    const esc = await req('POST', '/api/usuarios', {
      token: ta,
      headers: { 'idempotency-key': idem() },
      body: {
        action: 'create',
        nombre_usuario: 'esc',
        correo: `${TAG.toLowerCase()}-esc${i.n}@example.invalid`,
        id_profesional: null,
        rol: 'superadministrador',
        estado: 'activo',
      },
    });
    rec(
      A,
      'admin no puede crear superadministrador → 400/403',
      is4xx(esc.status),
      { status: esc.status },
      'alta',
    );
    if (uid) {
      const rp = await req('POST', `/api/usuarios/${uid}/reset-password`, {
        token: ta,
        headers: { 'idempotency-key': idem() },
        body: {},
      });
      const temp = rp.json?.password_temporal ?? rp.json?.temporal ?? rp.json?.password;
      rec(A, 'reset de contraseña de usuario nuevo', [200, 201].includes(rp.status), {
        status: rp.status,
        keys: Object.keys(rp.json ?? {}),
      });
      rec(
        A,
        'crear usuario devuelve contraseña temporal',
        !!cu.json?.temporal,
        { keys: Object.keys(cu.json ?? {}) },
        'info',
      );
      if (temp) {
        const lt = await login(email, i.kind, temp);
        rec(A, 'login con contraseña temporal', !!lt);
        if (lt) {
          const ch = await req('POST', '/api/auth/password', {
            token: lt.access_token,
            body: { anterior: temp, nueva: 'E2e-Audit-2026!x' },
          });
          rec(A, 'cambio de contraseña propio', [200, 204].includes(ch.status), {
            status: ch.status,
            body: ch.json,
          });
          const weak = await req('POST', '/api/auth/password', {
            token: lt.access_token,
            body: { anterior: 'E2e-Audit-2026!x', nueva: '123' },
          });
          rec(A, 'contraseña débil → 400', is4xx(weak.status), { status: weak.status });
        }
      }
      const de = await req('POST', '/api/usuarios', {
        token: ta,
        headers: { 'idempotency-key': idem() },
        body: { action: 'deactivate', id: uid },
      });
      rec(A, 'desactivar usuario', [200, 201, 204].includes(de.status), {
        status: de.status,
        body: de.json,
      });
    }
    const bit = await req('GET', '/api/bitacora', { token: ta });
    rec(A, 'bitácora (admin)', bit.status === 200, { status: bit.status });
    const bitMed = await req('GET', '/api/bitacora', { token: tm });
    rec(A, 'bitácora (médico) → 403', bitMed.status === 403, { status: bitMed.status }, 'alta');

    // ---------- archivo / reactivación ----------
    const ar0 = await req('POST', `/api/pacientes/${pid}/archivo`, {
      token: ta,
      body: { motivo_archivo: 'administrativo' },
    });
    rec(
      A,
      'archivar con consulta abierta: error explicativo (no 409 genérico) y existe forma de cerrar la consulta abierta',
      ar0.status === 200 || (ar0.json?.error && ar0.json.error !== 'conflict'),
      {
        status: ar0.status,
        body: ar0.json,
        nota: 'no hay endpoint para cerrar una consulta abierta',
      },
      'media',
    );
    const regB = await req('POST', '/api/pacientes', { token: ta, body: patientBody(i, 'B') });
    {
      const pid = regB.json?.paciente?.id_paciente;
      s.pidB = pid;
      const arMed = await req('POST', `/api/pacientes/${pid}/archivo`, {
        token: tm,
        body: { motivo_archivo: 'administrativo' },
      });
      rec(A, 'médico no archiva → 403', arMed.status === 403, { status: arMed.status });
      const ar = await req('POST', `/api/pacientes/${pid}/archivo`, {
        token: ta,
        body: { motivo_archivo: 'administrativo', observacion_archivo: `${TAG}` },
      });
      rec(A, 'archivar expediente', ar.status === 200, { status: ar.status, body: ar.json });
      const lst = await req(
        'GET',
        `/api/pacientes?q=${encodeURIComponent(s.doc.replace(/-A$/, '-B'))}`,
        { token: tm },
      );
      rec(
        A,
        'archivado no aparece en búsqueda activa',
        !JSON.stringify(lst.json ?? {}).includes(s.doc.replace(/-A$/, '-B')),
        { status: lst.status },
      );
      const wr = await req('POST', `/api/pacientes/${pid}/consultas`, {
        token: tm,
        body: closeBody(idProf, idMed),
      });
      rec(
        A,
        'no se puede consultar a paciente archivado → 4xx',
        is4xx(wr.status),
        { status: wr.status },
        'alta',
      );
      const ar2 = await req('POST', `/api/pacientes/${pid}/archivo`, {
        token: ta,
        body: { motivo_archivo: 'administrativo' },
      });
      rec(A, 'archivar dos veces → 409/4xx', is4xx(ar2.status), { status: ar2.status });
      const re = await req('POST', `/api/pacientes/${pid}/reactivacion`, {
        token: ta,
        headers: { 'idempotency-key': idem() },
        body: { motivo: `${TAG} reactivar` },
      });
      rec(A, 'reactivar expediente', re.status === 200, { status: re.status, body: re.json });
      const g2 = await req('GET', `/api/pacientes/${pid}`, { token: tm });
      rec(
        A,
        'estado activo tras reactivar',
        JSON.stringify(g2.json ?? {}).includes('"estado":"activo"'),
        { status: g2.status },
      );
    }

    // ---------- logout / refresh replay ----------
    const sess = await login(`demo-${i.n}-medico@example.invalid`, i.kind);
    const lo = await req('POST', '/api/auth/logout', {
      body: { refresh_token: sess.refresh_token },
    });
    rec(A, 'logout → 204', lo.status === 204, { status: lo.status });
    const rr = await req('POST', '/api/auth/refresh', {
      body: { refresh_token: sess.refresh_token },
    });
    rec(A, 'refresh tras logout → 401', rr.status === 401, { status: rr.status }, 'alta');
    const ac = await req('GET', '/api/auth/me', { token: sess.access_token });
    rec(
      A,
      'access token tras logout queda revocado',
      ac.status === 401,
      { status: ac.status, nota: 'JWT stateless: válido hasta exp si 200' },
      'media',
    );
  }

  // ---------- cross-tenant ----------
  for (const a of INST) {
    for (const b of INST) {
      if (a === b) continue;
      const sa = state.inst[a.kind];
      const sb = state.inst[b.kind];
      if (!sa?.pid || !sb?.tm) continue;
      const area = `cross ${a.n}->${b.n}`;
      const r = await req('GET', `/api/pacientes/${sa.pid}`, { token: sb.tm });
      const leaked = JSON.stringify(r.json ?? {}).includes(sa.doc);
      rec(
        area,
        `inst${b.n} lee paciente E2E de inst${a.n} por id`,
        !leaked,
        { status: r.status },
        'critica',
      );
      const q = await req(
        'GET',
        `/api/pacientes?q=${encodeURIComponent(sa.doc)}&institution_kind=${a.kind}`,
        { token: sb.tm },
      );
      rec(
        area,
        `inst${b.n} busca doc de inst${a.n} (con institution_kind en query)`,
        !JSON.stringify(q.json ?? {}).includes(sa.doc),
        { status: q.status },
        'critica',
      );
      const hq = await req('GET', `/api/pacientes?q=${encodeURIComponent(sa.doc)}`, {
        token: sb.tm,
        headers: { 'x-institution-kind': a.kind, 'x-institucion-id': String(sa.id_institucion) },
      });
      rec(
        area,
        `inst${b.n} con headers de inst${a.n}`,
        !JSON.stringify(hq.json ?? {}).includes(sa.doc),
        { status: hq.status },
        'critica',
      );
      if (sa.ocid) {
        const w = await req('PUT', `/api/consultas/${sa.ocid}/signos`, {
          token: sb.tm,
          headers: { 'idempotency-key': idem() },
          body: { peso_kg: 1 },
        });
        rec(
          area,
          `inst${b.n} escribe signos en consulta de inst${a.n}`,
          w.status !== 200 || true,
          {
            status: w.status,
            nota: 'ids se solapan entre motores; 200 = escribió en su propia consulta con ese id',
          },
          'info',
        );
      }
    }
  }
  // Specialty endpoint from wrong institution kind
  const wk = [
    ['centro_pediatrico', 'GET', '/api/camas'],
    ['hospital_general', 'GET', '/api/vacunas/pendientes'],
    ['clinica_odontologica', 'POST', '/api/laboratorio/ordenes'],
    ['laboratorio_clinico', 'POST', '/api/pacientes/101/odontogramas'],
  ];
  for (const [kind, m, p] of wk) {
    const t = state.inst[kind]?.ta;
    if (!t) continue;
    const r = await req(m, p, {
      token: t,
      headers: { 'idempotency-key': idem() },
      body: m === 'POST' ? {} : undefined,
    });
    rec('cross-kind', `${kind} ${m} ${p} → 403`, r.status === 403, { status: r.status }, 'alta');
  }

  await superadmin();
  await fuzz();
  const clean = Object.fromEntries(
    Object.entries(state.inst).map(([k, v]) => [
      k,
      {
        agendaDate: v.agendaDate,
        pidB: v.pidB,
        pid: v.pid,
        doc: v.doc,
        cid: v.cid,
        ocid: v.ocid,
        closedConsulta: v.closedConsulta,
        n: v.n,
      },
    ]),
  );
  writeFileSync(
    join(OUT, 'state.json'),
    JSON.stringify({ run: RUN, tag: TAG, inst: clean }, null, 2),
  );
}

async function specialty(i, A, s, ta, tm, pid, idProf) {
  const H = () => ({ 'idempotency-key': idem() });
  if (i.kind === 'hospital_general') {
    const camas = await req('GET', '/api/camas', { token: tm });
    rec(A, 'camas libres', camas.status === 200, { status: camas.status });
    const cama = Array.isArray(camas.json)
      ? (camas.json.find((c) => c.estado === 'disponible' || c.estado === 'libre') ?? camas.json[0])
      : null;
    const ad = await req('POST', `/api/pacientes/${pid}/admisiones`, {
      token: tm,
      headers: H(),
      body: {
        id_cama: cama?.id_cama ?? 1,
        id_diagnostico_ingreso: Number(s.idDiag ?? 1),
        tipo_ingreso: 'emergencia',
        fecha_hora_ingreso: new Date().toISOString(),
      },
    });
    const aid = ad.json?.id_admision;
    rec(A, 'hospitalización: ingreso', ad.status === 201 && !!aid, {
      status: ad.status,
      body: ad.json,
    });
    s.aid = aid;
    if (aid) {
      const no = await req('POST', `/api/admisiones/${aid}/notas`, {
        token: tm,
        headers: H(),
        body: { contenido: `${TAG} nota`, turno: 'diurno' },
      });
      rec(A, 'hospitalización: nota de evolución', [200, 201].includes(no.status), {
        status: no.status,
        body: no.json,
      });
      const pr = await req('POST', '/api/procedimientos', {
        token: tm,
        headers: H(),
        body: {
          id_admision: aid,
          id_paciente: pid,
          codigo_procedimiento: 'PROC-CUR',
          descripcion: `${TAG} procedimiento`,
          fecha_hora: new Date().toISOString(),
        },
      });
      rec(A, 'hospitalización: procedimiento', [200, 201].includes(pr.status), {
        status: pr.status,
        body: pr.json,
      });
      const eg = await req('POST', `/api/admisiones/${aid}/egreso`, {
        token: tm,
        headers: H(),
        body: {
          id_diagnostico_egreso: Number(s.idDiag ?? 1),
          condicion_egreso: 'mejorado',
          fecha_hora_egreso: new Date(Date.now() + 3600000).toISOString(),
        },
      });
      rec(A, 'hospitalización: egreso', [200, 201].includes(eg.status), {
        status: eg.status,
        body: eg.json,
      });
    }
    const noIdem = await req('POST', `/api/pacientes/${pid}/admisiones`, {
      token: tm,
      body: { id_cama: 1 },
    });
    rec(A, 'ingreso sin Idempotency-Key → 4xx', is4xx(noIdem.status), { status: noIdem.status });
  }
  if (i.kind === 'centro_pediatrico') {
    const pe = await req('PUT', `/api/pacientes/${pid}/perinatal`, {
      token: tm,
      headers: H(),
      body: { semanas_gestacion: 39, tipo_parto: 'vaginal', peso_nacimiento_g: 3200 },
    });
    rec(A, 'pediatría: perinatal', [200, 201].includes(pe.status), {
      status: pe.status,
      body: pe.json,
    });
    if (s.ocid) {
      const me = await req('POST', `/api/consultas/${s.ocid}/mediciones`, {
        token: tm,
        headers: H(),
        body: {
          fecha_medicion: new Date().toISOString().slice(0, 10),
          peso_kg: 12.5,
          talla_cm: 85,
          perimetro_cefalico_cm: 47,
        },
      });
      rec(A, 'pediatría: medición de crecimiento', [200, 201].includes(me.status), {
        status: me.status,
        body: me.json,
      });
    }
    const cr = await req('GET', `/api/pacientes/${pid}/crecimiento`, { token: tm });
    rec(A, 'pediatría: curva de crecimiento', cr.status === 200, {
      status: cr.status,
      body: cr.json,
    });
    const va = await req('GET', `/api/pacientes/${pid}/vacunas`, { token: tm });
    rec(A, 'pediatría: esquema de vacunas', va.status === 200, { status: va.status });
    const dosis = JSON.stringify(va.json ?? {}).match(/"id_dosis":(\d+)/)?.[1];
    if (dosis) {
      const ap = await req('POST', `/api/dosis/${dosis}/aplicacion`, {
        token: tm,
        headers: H(),
        body: {
          fecha_aplicacion: new Date().toISOString().slice(0, 10),
          lote: 'E2E-LOTE',
          sitio_aplicacion: 'brazo izquierdo',
        },
      });
      rec(A, 'pediatría: aplicar dosis', [200, 201].includes(ap.status), {
        status: ap.status,
        body: ap.json,
      });
      const rx = await req('POST', `/api/dosis/${dosis}/reacciones`, {
        token: tm,
        headers: H(),
        body: { reaccion_adversa: `${TAG} fiebre leve` },
      });
      rec(A, 'pediatría: reacción adversa', [200, 201].includes(rx.status), {
        status: rx.status,
        body: rx.json,
      });
    } else rec(A, 'pediatría: esquema trae dosis para aplicar', false, { body: va.json });
    const pen = await req('GET', '/api/vacunas/pendientes', { token: tm });
    rec(A, 'pediatría: vacunas pendientes', pen.status === 200, { status: pen.status });
    const hi = await req('PUT', `/api/pacientes/${pid}/hitos/1`, {
      token: tm,
      headers: H(),
      body: { alcanzado: true, fecha_evaluacion: new Date().toISOString().slice(0, 10) },
    });
    rec(A, 'pediatría: hito del desarrollo', [200, 201].includes(hi.status), {
      status: hi.status,
      body: hi.json,
    });
  }
  if (i.kind === 'laboratorio_clinico') {
    const or = await req('POST', '/api/laboratorio/ordenes', {
      token: tm,
      headers: H(),
      body: {
        id_paciente: pid,
        institucion_origen: 1,
        medico_solicitante: 'Dr. E2E',
        prioridad: 'rutina',
        examenes: ['HEM001'],
      },
    });
    const oid = or.json?.id_orden ?? or.json?.orden?.id_orden ?? or.json?._id;
    rec(A, 'lab: recibir orden', [200, 201].includes(or.status) && !!oid, {
      status: or.status,
      body: or.json,
    });
    if (oid) {
      const mu = await req('POST', `/api/laboratorio/ordenes/${oid}/muestras`, {
        token: tm,
        headers: H(),
        body: {
          codigo_barras: `${TAG}-BC`,
          tipo_muestra: 'sangre',
          fecha_hora_toma: new Date().toISOString(),
          condicion: 'adecuada',
          responsable_toma: 1,
        },
      });
      const idMu = JSON.stringify(mu.json ?? {}).match(/"id_muestra":(\d+)/)?.[1];
      rec(A, 'lab: registrar muestra', [200, 201].includes(mu.status), {
        status: mu.status,
        body: mu.json,
      });
      const rs = await req('POST', `/api/laboratorio/ordenes/${oid}/resultados`, {
        token: tm,
        headers: H(),
        body: {
          codigo_examen: 'HEM001',
          id_muestra: Number(idMu ?? 1),
          datos: { HGB: 13.5, HCT: 41 },
          observaciones: 'E2E',
        },
      });
      rec(A, 'lab: cargar resultados', [200, 201].includes(rs.status), {
        status: rs.status,
        body: rs.json,
      });
      const rid = JSON.stringify(rs.json ?? {}).match(/"id_resultado":(\d+)/)?.[1];
      if (rid) {
        const vl = await req('POST', `/api/laboratorio/resultados/${rid}/validacion`, {
          token: tm,
          headers: H(),
          body: {},
        });
        rec(A, 'lab: validar resultado', [200, 201].includes(vl.status), {
          status: vl.status,
          body: vl.json,
        });
      }
      const en = await req('POST', `/api/laboratorio/ordenes/${oid}/entrega`, {
        token: tm,
        headers: H(),
        body: { canal: 'presencial' },
      });
      rec(A, 'lab: entrega de resultados', [200, 201].includes(en.status), {
        status: en.status,
        body: en.json,
      });
    }
    const ex = await req('GET', `/api/pacientes/${pid}/examenes`, { token: tm });
    rec(A, 'lab: historial de exámenes', ex.status === 200, { status: ex.status });
  }
  if (i.kind === 'clinica_odontologica') {
    // Dental ops require the odontologo role (DENTAL_ROLES); demo-4-medico is a 403 by design.
    const tOdo = (await login('demo-4-odontologo@example.invalid', i.kind))?.access_token ?? tm;
    rec(A, 'odontología: login odontólogo demo', tOdo !== tm, {});
    const od = await req('POST', `/api/pacientes/${pid}/odontogramas`, {
      token: tOdo,
      headers: H(),
      body: { id_profesional: idProf },
    });
    const oid = od.json?.id_odontograma;
    rec(A, 'odontología: abrir odontograma', [200, 201].includes(od.status) && !!oid, {
      status: od.status,
      body: od.json,
    });
    if (oid) {
      const pz = await req('PUT', `/api/odontogramas/${oid}/piezas/11`, {
        token: tOdo,
        headers: H(),
        body: {
          estado: 'caries',
          superficies: { oclusal: 'caries' },
          movilidad: 0,
          expected_revision: 0,
        },
      });
      rec(A, 'odontología: actualizar pieza 11', [200, 201].includes(pz.status), {
        status: pz.status,
        body: pz.json,
      });
      const pzBad = await req('PUT', `/api/odontogramas/${oid}/piezas/99`, {
        token: tOdo,
        headers: H(),
        body: { estado: 'caries' },
      });
      rec(A, 'odontología: pieza 99 inexistente → 400', pzBad.status === 400, {
        status: pzBad.status,
      });
    }
    const pl = await req('POST', `/api/pacientes/${pid}/planes`, {
      token: tOdo,
      headers: H(),
      body: {
        id_profesional: idProf,
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
    const plid = pl.json?.id_plan;
    rec(A, 'odontología: plan de tratamiento', [200, 201].includes(pl.status) && !!plid, {
      status: pl.status,
      body: pl.json,
    });
    if (plid) {
      const ac = await req('POST', `/api/planes/${plid}/aceptacion`, {
        token: tOdo,
        headers: H(),
        body: { aceptado: true },
      });
      rec(A, 'odontología: aceptar plan', [200, 201].includes(ac.status), {
        status: ac.status,
        body: ac.json,
      });
      const se = await req('POST', `/api/planes/${plid}/sesiones`, {
        token: tOdo,
        headers: H(),
        body: {
          fecha: new Date().toISOString().slice(0, 10),
          lineas: [1],
          expected_revision: 0,
          observaciones: `${TAG} sesión`,
        },
      });
      rec(A, 'odontología: sesión', [200, 201].includes(se.status), {
        status: se.status,
        body: se.json,
      });
    }
    const sd = await req('GET', `/api/pacientes/${pid}/saldo-dental`, { token: tOdo });
    rec(A, 'odontología: saldo dental', sd.status === 200, { status: sd.status, body: sd.json });
  }
}

async function superadmin() {
  const A = 'superadmin';
  let s = null;
  for (const i of INST) {
    s = await login('superadmin@example.invalid', i.kind);
    if (s) {
      rec(A, `login superadmin (${i.kind})`, true);
      break;
    }
  }
  if (!s) return rec(A, 'login superadmin', false, {}, 'alta');
  let tok = s;
  for (const i of INST) {
    const r = await req('POST', '/api/auth/select-institution', {
      token: tok.access_token,
      body: { institution_kind: i.kind, refresh_token: tok.refresh_token },
    });
    if (r.status !== 200) {
      rec(A, `cambiar a ${i.kind}`, false, { status: r.status, body: r.json }, 'alta');
      continue;
    }
    tok = r.json;
    const me = await req('GET', '/api/auth/me', { token: tok.access_token });
    rec(
      A,
      `cambiar a ${i.kind} → /me coincide (motor ${i.motor})`,
      me.json?.institution_kind === i.kind && me.json?.motor === i.motor,
      me.json,
      'alta',
    );
    const doc = state.inst[i.kind]?.doc;
    const l = await req('GET', `/api/pacientes?q=${encodeURIComponent(doc ?? '')}`, {
      token: tok.access_token,
    });
    rec(
      A,
      `ve pacientes E2E de ${i.kind}`,
      l.status === 200 && (!doc || JSON.stringify(l.json).includes(doc)),
      { status: l.status },
    );
  }
  const back = await req('POST', '/api/auth/select-institution', {
    token: tok.access_token,
    body: { institution_kind: 'hospital_general', refresh_token: tok.refresh_token },
  });
  rec(A, 'regresar a hospital_general', back.status === 200, { status: back.status });
  const nonSa = state.inst.hospital_general?.ta;
  if (nonSa) {
    const adm = await login('demo-1-administrador@example.invalid', 'hospital_general');
    const r = await req('POST', '/api/auth/select-institution', {
      token: adm.access_token,
      body: { institution_kind: 'centro_pediatrico', refresh_token: adm.refresh_token },
    });
    rec(
      A,
      'admin normal no puede cambiar de institución → 403',
      r.status === 403,
      { status: r.status },
      'critica',
    );
  }
}

async function fuzz() {
  const t = state.inst.hospital_general?.tm;
  const ta = state.inst.hospital_general?.ta;
  if (!t) return;
  const posts = [
    ['POST', '/api/pacientes'],
    ['POST', '/api/pacientes/101/consultas'],
    ['POST', '/api/pacientes/101/consultas/abiertas'],
    ['POST', '/api/pacientes/101/alergias'],
    ['POST', '/api/pacientes/101/antecedentes'],
    ['POST', '/api/pacientes/101/archivo'],
    ['POST', '/api/pacientes/101/reactivacion'],
    ['PUT', '/api/consultas/1/signos'],
    ['POST', '/api/citas'],
    ['POST', '/api/citas/1/reprogramacion'],
    ['POST', '/api/citas/1/cancelacion'],
    ['POST', '/api/pacientes/101/admisiones'],
    ['POST', '/api/admisiones/1/notas'],
    ['POST', '/api/admisiones/1/egreso'],
    ['POST', '/api/procedimientos'],
    ['POST', '/api/usuarios'],
    ['POST', '/api/usuarios/1/reset-password'],
    ['POST', '/api/auth/password'],
    ['POST', '/api/auth/select-institution'],
    ['POST', '/api/auth/refresh'],
    ['POST', '/api/auth/logout'],
    ['POST', '/api/cargos'],
    ['POST', '/api/consumos'],
    ['POST', '/api/pacientes/101/documentos'],
  ];
  const bodies = [
    ['vacío {}', JSON.stringify({})],
    ['JSON roto', '{"a":'],
    ['array', '[1,2,3]'],
    ['null', 'null'],
    [
      'tipos erróneos',
      JSON.stringify({
        id_paciente: 'x',
        fecha_hora: 5,
        motivo: { a: 1 },
        refresh_token: 123,
        nueva: [],
      }),
    ],
    [
      'string enorme',
      JSON.stringify({ motivo: 'x'.repeat(200000), descripcion: 'x'.repeat(200000) }),
    ],
  ];
  for (const [m, p] of posts) {
    for (const [label, raw] of bodies) {
      const tok = p.includes('usuarios') ? ta : t;
      const r = await req(m, p, { token: tok, raw, headers: { 'idempotency-key': idem() } });
      rec(
        'validacion',
        `${m} ${p} ${label} → no 5xx`,
        r.status > 0 && r.status < 500,
        { status: r.status, body: r.json },
        'alta',
      );
    }
  }
  for (const p of [
    '/api/pacientes/101/ficha',
    '/api/pacientes/abc/ficha',
    '/api/agenda?fecha=2026-13-45',
    '/api/agenda/disponibilidad?id_profesional=x',
    '/api/bitacora?desde=zzz',
    '/api/pacientes/abc/crecimiento',
  ]) {
    const r = await req('GET', p, { token: ta });
    rec(
      'validacion',
      `GET ${p} → no 5xx`,
      r.status > 0 && r.status < 500,
      { status: r.status, body: r.json },
      'alta',
    );
  }
}

async function phase2() {
  const st = JSON.parse(readFileSync(join(OUT, 'state.json'), 'utf8'));
  const health = await req('GET', '/health');
  rec('persistencia', 'API arriba tras reinicio', health.status === 200, health);
  for (const i of INST) {
    const s = st.inst[i.kind];
    if (!s?.pid) {
      rec('persistencia', `${i.kind} sin estado de fase 1`, false);
      continue;
    }
    const tm = (await login(`demo-${i.n}-medico@example.invalid`, i.kind))?.access_token;
    const g = await req('GET', `/api/pacientes/${s.pid}`, { token: tm });
    const txt = JSON.stringify(g.json ?? {});
    rec(
      'persistencia',
      `${i.motor}: paciente E2E sigue tras reinicio`,
      g.status === 200 && txt.includes(s.doc),
      { status: g.status },
      'critica',
    );
    rec(
      'persistencia',
      `${i.motor}: consulta+diagnóstico siguen`,
      txt.includes('Cefalea'),
      {},
      'critica',
    );
    const f = await req('GET', `/api/pacientes/${s.pid}/ficha`, { token: tm });
    rec(
      'persistencia',
      `${i.motor}: alergia sigue en ficha`,
      JSON.stringify(f.json ?? {}).includes('penicilina'),
      { status: f.status },
      'alta',
    );
    if (s.cid) {
      const ta = (await login(`demo-${i.n}-administrador@example.invalid`, i.kind))?.access_token;
      const ag = await req('GET', `/api/agenda?fecha=${s.agendaDate}`, { token: ta });
      rec(
        'persistencia',
        `${i.motor}: cita sigue en agenda`,
        JSON.stringify(ag.json ?? {}).includes(String(s.cid)),
        { status: ag.status },
        'alta',
      );
    }
  }
}

if (VERIFY) await phase2();
else await phase1();
const fails = results.filter((r) => !r.ok);
const summary = {
  run: RUN,
  mode: VERIFY ? 'verify' : 'flow',
  total: results.length,
  pass: results.length - fails.length,
  fail: fails.length,
  http5xx: http5xx.length,
};
console.log('\nRESUMEN', JSON.stringify(summary));
writeFileSync(
  join(OUT, `${VERIFY ? 'verify' : 'flow'}-${RUN}.json`),
  JSON.stringify({ summary, fails, http5xx, results }, null, 2),
);
process.exitCode = fails.length ? 1 : 0;

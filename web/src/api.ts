import type {
  AuthTokensDto,
  ClinicalErrorCode,
  InstitutionKind,
  LoginRequestDto,
  RegisterPacienteRequest,
  PacienteResumen,
} from '@genki/shared';
import { clearSession, loadSession, saveSession } from './session';
import { navigate } from './router';

const messages: Record<ClinicalErrorCode, string> = {
  invalid_body: 'Solicitud inválida',
  invalid_query: 'Parámetros inválidos',
  missing_bearer: 'Se requiere autenticación',
  invalid_credentials: 'Credenciales o institución inválidas',
  invalid_token: 'Sesión inválida o vencida',
  password_policy: 'Contraseña fuera de la política mínima',
  forbidden: 'Permiso insuficiente',
  not_found: 'Recurso no encontrado',
  duplicate_document: 'Documento ya registrado en esta institución',
  guardian_required: 'Se requiere responsable principal',
  invalid_guardians: 'Debe existir exactamente un responsable principal',
  expediente_archived: 'El expediente está archivado',
  already_archived: 'El expediente ya está archivado',
  invalid_bundle: 'Atención clínica inconsistente',
  reference_not_found: 'Referencia clínica inválida',
  conflict: 'Operación en conflicto; vuelva a cargar',
  store_unavailable: 'Almacén no disponible',
  misconfigured: 'Configuración inválida',
  internal_error: 'Error interno',
};
export class ApiError extends Error {
  constructor(
    readonly code: ClinicalErrorCode,
    readonly status: number,
  ) {
    super(messages[code]);
  }
}
async function read<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as { error?: string };
    const code =
      body.error && Object.hasOwn(messages, body.error)
        ? (body.error as ClinicalErrorCode)
        : 'internal_error';
    throw new ApiError(code, response.status);
  }
  return response.status === 204 ? (undefined as T) : (response.json() as Promise<T>);
}
function expire(): void {
  generation++;
  clearSession();
  navigate('/login', true);
}
let refreshing: Promise<void> | null = null;
let generation = 0;
async function refresh(): Promise<void> {
  const session = loadSession();
  if (!session.refresh_token || !session.institution_kind) throw new ApiError('invalid_token', 401);
  const epoch = generation;
  const tokens = await read<AuthTokensDto>(
    await fetch('/api/auth/refresh', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: session.refresh_token }),
    }),
  );
  if (epoch !== generation || loadSession().refresh_token !== session.refresh_token)
    throw new ApiError('invalid_token', 401);
  saveSession(tokens, session.institution_kind);
}
export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const epoch = generation;
  const token = loadSession().access_token;
  const send = () => {
    const headers = new Headers(init.headers);
    headers.set('Authorization', `Bearer ${loadSession().access_token ?? ''}`);
    if (init.body) headers.set('Content-Type', 'application/json');
    return fetch(path, { ...init, headers });
  };
  let response = await send();
  if (response.status === 401) {
    try {
      if (epoch !== generation) throw new ApiError('invalid_token', 401);
      if (loadSession().access_token === token) {
        refreshing ??= refresh().finally(() => {
          refreshing = null;
        });
        await refreshing;
      }
      if (epoch !== generation) throw new ApiError('invalid_token', 401);
      response = await send();
      if (response.status === 401) throw new ApiError('invalid_token', 401);
    } catch (error) {
      if (epoch === generation) expire();
      throw error;
    }
  }
  return read<T>(response);
}
export async function login(input: LoginRequestDto): Promise<void> {
  const epoch = ++generation;
  clearSession();
  const tokens = await read<AuthTokensDto>(
    await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    }),
  );
  if (epoch !== generation) throw new ApiError('invalid_token', 401);
  saveSession(tokens, input.institution_kind);
}
export async function selectInstitution(institution_kind: InstitutionKind): Promise<void> {
  await api('/api/auth/me');
  const session = loadSession();
  if (!session.access_token || !session.refresh_token) throw new ApiError('invalid_token', 401);
  const epoch = generation;
  const tokens = await read<AuthTokensDto>(
    await fetch('/api/auth/select-institution', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${session.access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        institution_kind,
        refresh_token: session.refresh_token,
      }),
    }),
  );
  if (epoch !== generation) throw new ApiError('invalid_token', 401);
  generation++;
  saveSession(tokens, institution_kind);
}
export async function logout(): Promise<void> {
  generation++;
  const refresh_token = loadSession().refresh_token;
  try {
    if (refresh_token)
      await read<void>(
        await fetch('/api/auth/logout', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refresh_token }),
        }),
      );
  } finally {
    expire();
  }
}
export function registerPaciente(input: RegisterPacienteRequest): Promise<PacienteResumen> {
  const {
    tipo_documento,
    numero_documento,
    primer_nombre,
    segundo_nombre,
    primer_apellido,
    segundo_apellido,
    fecha_nacimiento,
    sexo,
    tipo_sangre,
    telefono,
    correo,
    direccion,
    id_municipio,
    responsables,
  } = input;
  return api('/api/pacientes', {
    method: 'POST',
    body: JSON.stringify({
      tipo_documento,
      numero_documento,
      primer_nombre,
      segundo_nombre,
      primer_apellido,
      segundo_apellido,
      fecha_nacimiento,
      sexo,
      tipo_sangre,
      telefono,
      correo,
      direccion,
      id_municipio,
      responsables,
    }),
  });
}
export function errorMessage(error: unknown): string {
  return error instanceof ApiError
    ? error.message
    : 'No se pudo contactar la API. Intente nuevamente.';
}

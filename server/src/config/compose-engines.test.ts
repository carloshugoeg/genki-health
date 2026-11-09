import { randomBytes } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import { asInstitutionId, type InstitutionKind } from '@genki/shared';
import type { AdapterResource, AuthPort, EngineOptions, FirestoreOptions } from '../ports/index.js';
import { buildMemoryAdapterSet } from './memory-adapter-set.js';
import { composeEngines, engineFactories } from './compose-engines.js';
import { readEnv, type EnginesEnv } from './env.js';

// Port/factory composition checks only; these spies do not prove physical readiness.
function fixture() {
  const ephemeral = randomBytes(32).toString('hex');
  const env = readEnv({
    GENKI_MODE: 'engines',
    JWT_SECRET: ephemeral,
    DATABASE_URL: `postgres://genki_app_login:${ephemeral}@127.0.0.1/genki_test_composition`,
    AUTH_DATABASE_URL: `postgres://genki_identity_login:${ephemeral}@127.0.0.1/genki_test_composition`,
    MYSQL_URL: `mysql://genki_app_login:${ephemeral}@127.0.0.1/genki_test_composition`,
    MONGODB_URI: `mongodb://genkiApp:${ephemeral}@127.0.0.1/genki_test_composition`,
    FIRESTORE_EMULATOR_HOST: '127.0.0.1:8080',
    GCLOUD_PROJECT: 'demo-genki-health',
  }) as EnginesEnv;
  const resources: (AdapterResource & { close: ReturnType<typeof vi.fn> })[] = [];
  const factory = vi.fn(
    async (options: EngineOptions | FirestoreOptions): Promise<AdapterResource> => {
      const resource = {
        set: buildMemoryAdapterSet(options.kind, options.id_institucion),
        close: vi.fn(async () => {}),
      };
      vi.spyOn(resource.set.catalogos, 'list').mockResolvedValue({
        municipios: [{ id_municipio: 1, nombre: 'Prueba' }],
        profesionales: [{ id_profesional: 1, nombres: 'Profesional', apellidos: 'Simulado' }],
        medicamentos: [{ id_medicamento: 1, nombre_generico: 'Simulado' }],
      });
      resources.push(resource);
      return resource;
    },
  );
  const unused = async (): Promise<never> => {
    throw new Error('Not exercised by composition test');
  };
  const auth: AuthPort = {
    login: unused,
    refresh: unused,
    logout: unused,
    verifyAccessToken: unused,
  };
  const identityClose = vi.fn(async () => {});
  const factories: typeof engineFactories = {
    postgres: factory,
    mysql: factory,
    mongodb: factory,
    firebase: factory,
    checkNative: vi.fn(async () => {}),
    auth: vi.fn(async () => ({ auth, close: identityClose })),
  };
  return { env, factories, resources, identityClose, auth, factory };
}

describe('real engine composition contract (factory spies)', () => {
  it('engine_registry_routes_1_2_3_4_without_fallback', async () => {
    const f = fixture();
    const composed = await composeEngines(f.env, f.factories);
    try {
      const kinds: InstitutionKind[] = [
        'hospital_general',
        'centro_pediatrico',
        'laboratorio_clinico',
        'clinica_odontologica',
      ];
      kinds.forEach((kind, index) => {
        const resolved = composed.registry.resolve(kind, asInstitutionId(index + 1));
        expect(resolved).toBe(f.resources[index]!.set);
        expect(composed.registry.resolve(kind, asInstitutionId(index + 1))).toBe(resolved);
      });
      expect(f.factory).toHaveBeenCalledTimes(4);
      expect(() => composed.registry.resolve('hospital_general', asInstitutionId(2))).toThrow();
    } finally {
      await composed.close();
    }
  });
  it('engine_mode_auth_always_uses_hospital_pg', async () => {
    const f = fixture();
    const composed = await composeEngines(f.env, f.factories);
    try {
      expect(composed.auth).toBe(f.auth);
      expect(f.factories.auth).toHaveBeenCalledTimes(1);
      expect(f.factories.auth).toHaveBeenCalledWith({
        url: f.env.authDatabaseUrl,
        jwtSecret: f.env.jwtSecret,
      });
    } finally {
      await composed.close();
    }
  });
  it('missing_engine_is_startup_failure', async () => {
    const f = fixture();
    f.factories.mongodb = vi.fn(async () => {
      throw new Error('Unavailable');
    });
    await expect(composeEngines(f.env, f.factories)).rejects.toThrow('mongodb initialization');
    expect(f.resources).toHaveLength(2);
    f.resources.forEach((resource) => expect(resource.close).toHaveBeenCalledTimes(1));
    expect(f.factories.auth).not.toHaveBeenCalled();
    expect(() => readEnv({ GENKI_MODE: 'engines', JWT_SECRET: f.env.jwtSecret })).toThrow();
  });
  it('shutdown_closes_all_pools_once', async () => {
    const f = fixture();
    const composed = await composeEngines(f.env, f.factories);
    await Promise.all([composed.close(), composed.close()]);
    await composed.close();
    f.resources.forEach((resource) => expect(resource.close).toHaveBeenCalledTimes(1));
    expect(f.identityClose).toHaveBeenCalledTimes(1);
  });
});

import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { FastifyInstance } from 'fastify';
import { buildHttpApp } from './adapters/http/app.js';
import { createPhase0Identity, createPhase0Registry } from './config/compose-memory.js';
import { composeEngines } from './config/compose-engines.js';
import { loadEnv } from './config/env.js';

export async function start(): Promise<FastifyInstance> {
  const env = loadEnv(); // Validates all configuration before opening any resources.
  if (env.mode === 'memory')
    console.warn(
      'GENKI_MODE=memory: TEST/DEVELOPMENT ONLY, nonpersistent clinical data and identities',
    );
  else console.log('GENKI_MODE=engines: four physical stores; identity=Hospital PostgreSQL');
  const composition =
    env.mode === 'engines'
      ? await composeEngines(env)
      : await (async () => {
          const identity = await createPhase0Identity(env.jwtSecret);
          return {
            registry: createPhase0Registry(),
            auth: identity.auth,
            account: identity.account,
            users: identity.users,
            close: async () => {},
          };
        })();
  let app: FastifyInstance | undefined;
  let stopping: Promise<void> | undefined;
  const shutdown = (): Promise<void> =>
    (stopping ??= (async () => {
      if (app) await app.close();
      else await composition.close();
    })());
  const signal = (): void => {
    shutdown().catch(() => {
      console.error('API shutdown failed');
      process.exitCode = 1;
    });
  };
  try {
    app = buildHttpApp({
      registry: composition.registry,
      auth: composition.auth,
      account: composition.account,
      users: composition.users,
    });
    app.addHook('onClose', async () => {
      process.off('SIGINT', signal);
      process.off('SIGTERM', signal);
      await composition.close();
    });
    process.once('SIGINT', signal);
    process.once('SIGTERM', signal);
    await app.listen({ host: env.host, port: env.port });
    console.log(`Genki Health API listening on http://${env.host}:${env.port}`);
    return app;
  } catch {
    let cleanupFailed = false;
    await shutdown().catch(() => {
      cleanupFailed = true;
    });
    throw new Error(
      `API startup/listen failed; ${cleanupFailed ? 'resource cleanup failed' : 'cleanup completed'}`,
    );
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  start().catch((error: unknown) => {
    // Startup errors from composition/env contain safe stage/env names, never native DSNs.
    console.error(error instanceof Error ? error.message : 'API startup failed');
    process.exitCode = 1;
  });
}

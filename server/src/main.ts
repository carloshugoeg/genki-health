import { buildHttpApp } from './adapters/http/app.js';
import { createPhase0Auth, createPhase0Registry } from './config/compose-memory.js';

const host = process.env.API_HOST ?? '127.0.0.1';
const port = Number(process.env.API_PORT ?? '3000');
const jwtSecret =
  process.env.JWT_SECRET ??
  (process.env.NODE_ENV === 'production' ? '' : 'genki-dev-jwt-secret-change-me');

if (!jwtSecret || jwtSecret.length < 16) {
  console.error('JWT_SECRET must be set (min 16 characters)');
  process.exit(1);
}

const auth = await createPhase0Auth(jwtSecret);
const app = buildHttpApp({
  registry: createPhase0Registry(),
  auth,
});

await app.listen({ host, port });
console.log(`Genki Health API listening on http://${host}:${port}`);

import { buildHttpApp } from './adapters/http/app.js';
import { createPhase0Auth, createPhase0Registry } from './config/compose-memory.js';

const host = process.env.API_HOST ?? '127.0.0.1';
const port = Number(process.env.API_PORT ?? '3000');
const jwtSecret = process.env.JWT_SECRET ?? '';

if (!jwtSecret || jwtSecret.length < 16) {
  console.error('JWT_SECRET must be set (min 16 characters)');
  process.exit(1);
}

if (!process.env.SEED_PASSWORD || process.env.SEED_PASSWORD.trim().length === 0) {
  console.error('SEED_PASSWORD must be set for demo identity users');
  process.exit(1);
}

const auth = await createPhase0Auth(jwtSecret);
const app = buildHttpApp({
  registry: createPhase0Registry(),
  auth,
});

await app.listen({ host, port });
console.log(`Genki Health API listening on http://${host}:${port}`);

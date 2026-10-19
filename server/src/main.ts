import { buildHttpApp } from './adapters/http/app.js';
import { createPhase0Registry } from './config/compose-memory.js';

const host = process.env.API_HOST ?? '127.0.0.1';
const port = Number(process.env.API_PORT ?? '3000');

const app = buildHttpApp({
  registry: createPhase0Registry(),
  // Hospital general is Carlos's engine; used only as Phase-0 default without Auth.
  defaultKind: 'hospital_general',
});

await app.listen({ host, port });
console.log(`Genki Health API (Phase 0) listening on http://${host}:${port}`);

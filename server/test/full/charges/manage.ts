import 'dotenv/config';
import { connect, engines, seed, type Engine } from './harness.js';
const [action, engine] = process.argv.slice(2);
if (!['migrate', 'seed'].includes(action ?? '') || !engines.includes(engine as Engine))
  throw new Error(
    'Usage: tsx server/test/full/charges/manage.ts <migrate|seed> <postgres|mysql|mongodb|firebase>',
  );
const connection = await connect(engine as Engine);
try {
  if (action === 'migrate') await connection.migrate();
  else await seed(connection.store);
  console.log(`${action} ${engine}: OK`);
} finally {
  await connection.close();
}

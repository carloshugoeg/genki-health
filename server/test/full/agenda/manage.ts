/** npx tsx server/test/full/agenda/manage.ts migrate|seed [postgres|mysql|mongodb|firebase] */
import { nativeAgenda, seedAgenda, type Engine } from './fixtures.js';
const engines: Engine[] = ['postgres', 'mysql', 'mongodb', 'firebase'];
const [command, engine] = process.argv.slice(2);
if (!['migrate', 'seed'].includes(command ?? '') || (engine && !engines.includes(engine as Engine)))
  throw new Error('Uso: manage.ts migrate|seed [postgres|mysql|mongodb|firebase]');
for (const selected of engine ? [engine as Engine] : engines) {
  if (command === 'seed') await seedAgenda(selected);
  else {
    const native = await nativeAgenda(selected);
    try {
      await native.migrate();
    } finally {
      await native.close();
    }
  }
  console.log(`${selected}: ${command} OK`);
}

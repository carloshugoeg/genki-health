import { afterAll } from 'vitest';
import { clinicalContract } from './clinical.contract.js';
import { closeMongoHarnessSharedClient, makeMongoClinicalHarness } from './mongodb-harness.js';

clinicalContract('mongodb', makeMongoClinicalHarness);

afterAll(async () => {
  await closeMongoHarnessSharedClient();
});

import { afterAll } from 'vitest';
import { clinicalContract } from './clinical.contract.js';
import { closeMysqlHarnessSharedClient, makeMysqlClinicalHarness } from './mysql-harness.js';

clinicalContract('mysql', makeMysqlClinicalHarness);

afterAll(async () => {
  await closeMysqlHarnessSharedClient();
});

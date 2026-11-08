import { clinicalContract } from './clinical.contract.js';
import { makeMemoryClinicalHarness } from './memory-harness.js';

clinicalContract('memory', makeMemoryClinicalHarness);

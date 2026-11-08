import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const serverRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const PHYSICAL_CONTRACT_RUNNERS = [
  'test/contracts/postgres.test.ts',
  'test/contracts/mysql.test.ts',
  'test/contracts/mongodb.test.ts',
  'test/contracts/firebase.test.ts',
] as const;

function loadExclude(testEngines: boolean): string[] {
  const env = { ...process.env };
  if (testEngines) {
    env.TEST_ENGINES = '1';
  } else {
    delete env.TEST_ENGINES;
  }

  const script = `
    import { loadConfigFromFile } from 'vite';
    import path from 'node:path';
    const loaded = await loadConfigFromFile(
      { command: 'serve', mode: 'test' },
      path.resolve('vitest.config.ts'),
    );
    process.stdout.write(JSON.stringify(loaded?.config?.test?.exclude ?? []));
  `;

  const result = spawnSync(process.execPath, ['--input-type=module', '-e', script], {
    cwd: serverRoot,
    env,
    encoding: 'utf8',
  });
  if (result.status !== 0) {
    throw new Error(result.stderr || result.stdout || 'vitest config load failed');
  }
  return JSON.parse(result.stdout) as string[];
}

describe('vitest engine selection', () => {
  it('TEST_ENGINES gates physical contract runners; memory always selected', () => {
    const off = loadExclude(false);
    const on = loadExclude(true);

    for (const runner of PHYSICAL_CONTRACT_RUNNERS) {
      expect(off, `default must exclude ${runner}`).toContain(runner);
      expect(on, `TEST_ENGINES=1 must select ${runner}`).not.toContain(runner);
    }

    expect(off).not.toContain('test/contracts/memory.test.ts');
    expect(on).not.toContain('test/contracts/memory.test.ts');
  });
});

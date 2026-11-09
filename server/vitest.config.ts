import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

const rootEnv = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../.env');
dotenv.config({ path: rootEnv, override: false });

const testEngines = process.env.TEST_ENGINES === '1';

const exclude: string[] = [];

if (!testEngines) {
  exclude.push(
    'test/contracts/postgres.test.ts',
    'test/contracts/mysql.test.ts',
    'test/contracts/mongodb.test.ts',
    'test/contracts/firebase.test.ts',
    'src/adapters/postgres/**/*.test.ts',
    'src/adapters/mysql/**/*.test.ts',
    'src/adapters/mongodb/**/*.test.ts',
    'src/adapters/firebase/**/*.test.ts',
    'test/seeds.test.ts',
    'test/persistence.test.ts',
    'test/security/**',
  );
}

export default defineConfig({
  test: {
    include: ['src/**/*.test.ts', 'test/**/*.test.ts'],
    setupFiles: ['./src/test/setup-credentials.ts'],
    exclude,
    ...(testEngines
      ? {
          testTimeout: 30_000,
          fileParallelism: false,
        }
      : {}),
    coverage: {
      provider: 'v8',
      include: ['src/domain/**/*.ts', 'src/application/**/*.ts'],
      exclude: ['src/**/*.test.ts', 'src/adapters/**'],
      thresholds: {
        lines: 80,
      },
      reporter: ['text', 'json-summary'],
    },
  },
});

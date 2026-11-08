import { defineConfig } from 'vitest/config';

const contractOptIn = process.env.CONTRACT_RED === '1' || process.env.CONTRACT_READY === '1';
const testEngines = process.env.TEST_ENGINES === '1';

const exclude: string[] = [];

if (!contractOptIn) {
  exclude.push('test/contracts/**');
} else if (!testEngines) {
  exclude.push(
    'test/contracts/postgres.test.ts',
    'test/contracts/mysql.test.ts',
    'test/contracts/mongodb.test.ts',
    'test/contracts/firebase.test.ts',
  );
}

if (!testEngines) {
  exclude.push(
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
    exclude,
    ...(testEngines
      ? {
          testTimeout: 30_000,
          fileParallelism: false,
        }
      : {}),
  },
});

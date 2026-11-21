import { resolve } from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      '@modules': resolve(import.meta.dirname, 'src/modules'),
    },
  },
  test: {
    include: ['src/**/*.test.ts'],
    // A test whose oracle is a browser launches one in its file's `beforeAll`, and some also bundle code for the
    // page there. A cold Chromium start on a busy CI runner can take more than the 10 s default, which fails the
    // whole file before any test runs. The hook timeout governs `beforeAll`, not the test timeout.
    testTimeout: 30_000,
    hookTimeout: 30_000,
  },
});

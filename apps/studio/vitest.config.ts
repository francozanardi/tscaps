import { resolve } from 'node:path';
import { defineConfig } from 'vitest/config';

// Kept apart from `vite.config.ts` so the dev-server plugins never load
// for a test run. Only the aliases tests actually resolve are listed; an
// unlisted one fails loudly at import rather than silently resolving
// somewhere else.
export default defineConfig({
  resolve: {
    alias: {
      // Present so a test that reaches studio's person-segmentation
      // wiring resolves the runtime the same way a build does. Every
      // config that aliases `@core` needs this one beside it.
      '@mediapipe-runtime': resolve(import.meta.dirname, 'node_modules/@mediapipe/tasks-vision/wasm'),
      '@tscaps/engine': resolve(import.meta.dirname, '../../packages/engine/src/index.ts'),
      '@modules': resolve(import.meta.dirname, '../../packages/engine/src/modules'),
      '@bootstrap': resolve(import.meta.dirname, 'src/bootstrap'),
      '@core': resolve(import.meta.dirname, 'src/core'),
      '@presentation': resolve(import.meta.dirname, 'src/presentation'),
      '@ui': resolve(import.meta.dirname, 'src/ui'),
      '@shared/browser': resolve(import.meta.dirname, './shared/browser/index.ts'),
    },
  },
  test: {
    include: ['src/**/*.test.ts'],
    // A test whose oracle is a browser launches one itself, and a cold
    // Chromium start costs more than the default allows.
    testTimeout: 20_000,
  },
});

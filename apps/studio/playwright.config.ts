import { defineConfig } from '@playwright/test';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  workers: 1,
  timeout: 120_000,
  expect: { timeout: 15_000 },
  use: {
    baseURL: 'http://localhost:4173',
    trace: 'on-first-retry',
  },
  projects: [
    { name: 'chromium', use: { browserName: 'chromium' } },
  ],
  ...(process.env['E2E_SKIP_WEBSERVER'] === '1' ? {} : {
    webServer: {
      command: 'pnpm preview --port 4173 --strictPort',
      url: 'http://localhost:4173/',
      timeout: 60_000,
      reuseExistingServer: !process.env['CI'],
      cwd: __dirname,
    },
  }),
});

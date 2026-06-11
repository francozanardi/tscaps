import path from 'node:path';
import { mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { createServer, type ViteDevServer } from 'vite';
import { chromium, type Browser } from 'playwright';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PACKAGE_ROOT = path.resolve(HERE, '..');
const OUTPUT_DIR = path.join(PACKAGE_ROOT, 'output');
const OUTPUT_FILENAME = 'cli-defaults.mp4';

run().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});

async function run(): Promise<void> {
  await mkdir(OUTPUT_DIR, { recursive: true });
  const server = await startViteDevServer();
  try {
    const browser = await chromium.launch();
    try {
      await renderHeadlessOnce(server, browser);
    } finally {
      await browser.close();
    }
  } finally {
    await server.close();
  }
}

async function startViteDevServer(): Promise<ViteDevServer> {
  const server = await createServer({
    root: PACKAGE_ROOT,
    configFile: path.join(PACKAGE_ROOT, 'vite.config.ts'),
    server: { host: '127.0.0.1', port: 0 },
  });
  await server.listen();
  return server;
}

async function renderHeadlessOnce(server: ViteDevServer, browser: Browser): Promise<void> {
  const url = resolveServerUrl(server);
  const context = await browser.newContext({ acceptDownloads: true });
  const page = await context.newPage();

  page.on('console', (msg) => console.log(`[page ${msg.type()}] ${msg.text()}`));
  page.on('pageerror', (err) => console.error('[page error]', err.message));

  console.log(`Opening ${url}cli/runner.html`);
  await page.goto(`${url}cli/runner.html`);

  console.log('Triggering render — this may take a while on first run (Whisper model download).');
  // Whisper model download + transcription + render routinely exceeds
  // Playwright's 30s default; pipeline-side progress logs surface real
  // activity, so the wait stays open until the download finally fires.
  const downloadPromise = page.waitForEvent('download', { timeout: 0 });
  await page.evaluate(() => window.renderHeadless());
  const download = await downloadPromise;

  const outputPath = path.join(OUTPUT_DIR, OUTPUT_FILENAME);
  await download.saveAs(outputPath);
  console.log(`Wrote ${outputPath}`);
}

function resolveServerUrl(server: ViteDevServer): string {
  const url = server.resolvedUrls?.local?.[0];
  if (url === undefined) throw new Error('Vite dev server is running but exposes no local URL');
  return url;
}

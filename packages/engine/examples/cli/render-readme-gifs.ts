import path from 'node:path';
import { mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { createServer, type ViteDevServer } from 'vite';
import { chromium, type Browser, type Page } from 'playwright';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PACKAGE_ROOT = path.resolve(HERE, '..');
const OUTPUT_DIR = path.join(PACKAGE_ROOT, 'output');

const VARIANTS: ReadonlyArray<ReadmeVariant> = [
  { browserFunction: 'renderFromSrtVariant', outputFilename: 'readme-from-srt.mp4' },
  { browserFunction: 'renderCustomCssVariant', outputFilename: 'readme-custom-css.mp4' },
  { browserFunction: 'renderCssAlignmentVariant', outputFilename: 'readme-css-alignment.mp4' },
  { browserFunction: 'renderKaraokeVariant', outputFilename: 'readme-karaoke.mp4' },
  { browserFunction: 'renderSlideInVariant', outputFilename: 'readme-slide-in.mp4' },
  { browserFunction: 'renderSingleWordVariant', outputFilename: 'readme-single-word.mp4' },
];

interface ReadmeVariant {
  readonly browserFunction: string;
  readonly outputFilename: string;
}

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
      await renderEveryVariant(server, browser);
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

async function renderEveryVariant(server: ViteDevServer, browser: Browser): Promise<void> {
  const serverUrl = resolveServerUrl(server);
  const context = await browser.newContext({ acceptDownloads: true });
  const page = await context.newPage();

  page.on('console', (msg) => {
    if (msg.type() === 'error') console.error(`[page error] ${msg.text()}`);
  });
  page.on('pageerror', (err) => console.error('[page error]', err.message));

  console.log(`Opening ${serverUrl}cli/readme-runner.html`);
  await page.goto(`${serverUrl}cli/readme-runner.html`);

  for (const variant of VARIANTS) {
    await renderVariantToDisk(page, variant);
  }
}

async function renderVariantToDisk(page: Page, variant: ReadmeVariant): Promise<void> {
  console.log(`Rendering ${variant.outputFilename}…`);
  const downloadPromise = page.waitForEvent('download', { timeout: 0 });
  await page.evaluate(
    (functionName) => (window as unknown as Record<string, () => Promise<void>>)[functionName]!(),
    variant.browserFunction,
  );
  const download = await downloadPromise;
  const outputPath = path.join(OUTPUT_DIR, variant.outputFilename);
  await download.saveAs(outputPath);
  console.log(`  Wrote ${outputPath}`);
}

function resolveServerUrl(server: ViteDevServer): string {
  const url = server.resolvedUrls?.local?.[0];
  if (url === undefined) throw new Error('Vite dev server is running but exposes no local URL');
  return url;
}

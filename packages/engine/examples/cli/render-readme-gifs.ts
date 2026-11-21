import path from 'node:path';
import { mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { createServer, type ViteDevServer } from 'vite';
import { chromium, type Browser, type Download, type Page } from 'playwright';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PACKAGE_ROOT = path.resolve(HERE, '..');
const OUTPUT_DIR = path.join(PACKAGE_ROOT, 'output');

const VARIANTS: ReadonlyArray<ReadmeVariant> = [
  { browserFunction: 'renderFromSrtVariant', outputFilenames: ['readme-from-srt.mp4'] },
  { browserFunction: 'renderCustomCssVariant', outputFilenames: ['readme-custom-css.mp4'] },
  { browserFunction: 'renderCssAlignmentVariant', outputFilenames: ['readme-css-alignment.mp4'] },
  { browserFunction: 'renderKaraokeVariant', outputFilenames: ['readme-karaoke.mp4'] },
  { browserFunction: 'renderSlideInVariant', outputFilenames: ['readme-slide-in.mp4'] },
  { browserFunction: 'renderSingleWordVariant', outputFilenames: ['readme-single-word.mp4'] },
  { browserFunction: 'renderBrollVariant', outputFilenames: ['readme-broll.mp4'] },
  { browserFunction: 'renderPictureInPictureVariant', outputFilenames: ['readme-picture-in-picture.mp4'] },
  { browserFunction: 'renderSplitScreenVariant', outputFilenames: ['readme-split-screen.mp4'] },
  { browserFunction: 'renderSquarePushInVariant', outputFilenames: ['readme-square-push-in.mp4'] },
  { browserFunction: 'renderMusicAndCutVariant', outputFilenames: ['readme-music-and-cut.mp4'] },
  { browserFunction: 'renderWithoutCaptionsVariant', outputFilenames: ['readme-still-at-6.5s.png', 'readme-without-captions.mp4'] },
];

interface ReadmeVariant {
  readonly browserFunction: string;
  /** Every file the variant downloads, by the name it downloads it under. */
  readonly outputFilenames: ReadonlyArray<string>;
}

/** Variants named on the command line, by their browser function; every variant when none is. */
const SELECTED_VARIANTS = process.argv.slice(2);

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

  const variants = SELECTED_VARIANTS.length === 0
    ? VARIANTS
    : VARIANTS.filter((variant) => SELECTED_VARIANTS.includes(variant.browserFunction));
  for (const variant of variants) {
    await renderVariantToDisk(page, variant);
  }
}

async function renderVariantToDisk(page: Page, variant: ReadmeVariant): Promise<void> {
  console.log(`Rendering ${variant.outputFilenames.join(', ')}…`);
  const downloads: Download[] = [];
  const collect = (download: Download) => downloads.push(download);
  page.on('download', collect);
  try {
    await page.evaluate(
      (functionName) => (window as unknown as Record<string, () => Promise<void>>)[functionName]!(),
      variant.browserFunction,
    );
    while (downloads.length < variant.outputFilenames.length) await page.waitForTimeout(100);
  } finally {
    page.off('download', collect);
  }
  for (const download of downloads) {
    const outputPath = path.join(OUTPUT_DIR, download.suggestedFilename());
    await download.saveAs(outputPath);
    console.log(`  Wrote ${outputPath}`);
  }
}

function resolveServerUrl(server: ViteDevServer): string {
  const url = server.resolvedUrls?.local?.[0];
  if (url === undefined) throw new Error('Vite dev server is running but exposes no local URL');
  return url;
}

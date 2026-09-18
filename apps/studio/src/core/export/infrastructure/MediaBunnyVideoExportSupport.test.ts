import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { chromium, type Browser, type Page } from '@playwright/test';
import { build, type Plugin } from 'vite';

/**
 * Whether a browser can encode a video at all is the browser's answer,
 * not ours, so the question is put to a real one. The second case is
 * the one the gate exists for: a runtime with no `VideoEncoder` must
 * come back `false` rather than throw, because the caller turns that
 * answer into the one thing it can tell the reader before any work is
 * spent on their video.
 *
 * The page is served on `http://localhost` through route interception
 * because WebCodecs only exists in secure contexts — a `setContent`
 * page on an opaque origin has no `VideoEncoder` at all and the first
 * case would fail for the wrong reason.
 */

const FIXTURE_ID = 'virtual:video-export-support-fixture';
const FIXTURE_SOURCE = `
  export { MediaBunnyVideoExportSupport } from '@core/export/infrastructure/MediaBunnyVideoExportSupport';
`;

let browser: Browser;
let bundle: string;

beforeAll(async () => {
  browser = await chromium.launch();
  bundle = await bundleForThePage();
}, 120_000);

afterAll(async () => { await browser.close(); });

function fixtureModulePlugin(): Plugin {
  const resolved = `\0${FIXTURE_ID}`;
  return {
    name: 'video-export-support-fixture',
    resolveId: (id) => (id === FIXTURE_ID ? resolved : null),
    load: (id) => (id === resolved ? FIXTURE_SOURCE : null),
  };
}

async function bundleForThePage(): Promise<string> {
  const result = await build({
    configFile: false,
    logLevel: 'error',
    plugins: [fixtureModulePlugin()],
    resolve: { alias: { '@core': new URL('../..', import.meta.url).pathname } },
    build: {
      write: false,
      minify: false,
      rollupOptions: {
        input: FIXTURE_ID,
        preserveEntrySignatures: 'strict',
        output: { format: 'iife', name: 'fixture', entryFileNames: 'fixture.js' },
      },
    },
  });
  const output = Array.isArray(result) ? result[0]!.output : 'output' in result ? result.output : [];
  return (output as ReadonlyArray<{ type: string; code?: string }>)
    .filter((chunk) => chunk.type === 'chunk')
    .map((chunk) => chunk.code ?? '')
    .join('\n');
}

async function pageWithSupport(): Promise<Page> {
  const page = await browser.newPage();
  await page.route('**/*', (route) => route.fulfill({
    contentType: 'text/html',
    body: '<!doctype html><html><body></body></html>',
  }));
  await page.goto('http://localhost/video-export-support-test');
  await page.addScriptTag({ content: bundle });
  return page;
}

/** Asks the page whether it can export, or reports the thrown error's name. */
async function askIsAvailable(page: Page, options: { withoutVideoEncoder: boolean }): Promise<boolean | string> {
  return page.evaluate<boolean | string, { withoutVideoEncoder: boolean }>(
    async ({ withoutVideoEncoder }) => {
      if (withoutVideoEncoder) delete (window as { VideoEncoder?: unknown }).VideoEncoder;
      const support = new (window as never as { fixture: { MediaBunnyVideoExportSupport: new () => { isSupported(): Promise<boolean> } } }).fixture.MediaBunnyVideoExportSupport();
      try {
        return await support.isSupported();
      } catch (err) {
        return err instanceof Error ? err.name : 'unknown';
      }
    },
    { withoutVideoEncoder: options.withoutVideoEncoder },
  );
}

describe('MediaBunnyVideoExportSupport', () => {
  it('answers yes on a browser with WebCodecs video encoding', async () => {
    const page = await pageWithSupport();
    try {
      await expect(askIsAvailable(page, { withoutVideoEncoder: false })).resolves.toBe(true);
    } finally {
      await page.close();
    }
  });

  it('answers no on a browser with no video encoder at all', async () => {
    const page = await pageWithSupport();
    try {
      await expect(askIsAvailable(page, { withoutVideoEncoder: true })).resolves.toBe(false);
    } finally {
      await page.close();
    }
  });
});

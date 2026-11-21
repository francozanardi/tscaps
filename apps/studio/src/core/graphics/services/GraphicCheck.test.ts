import { resolve } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { chromium, type Browser, type Page } from '@playwright/test';
import { build, type Plugin } from 'vite';
import type { GraphicDocument } from '@core/graphics/domain/GraphicDocument';
import type { GraphicMessage } from '@core/graphics/domain/GraphicMessage';
import type { Graphic } from '@core/graphics/domain/Graphic';
import type { GraphicStage } from '@core/graphics/domain/GraphicStage';

/**
 * A graphic checked in its sandboxed frame, in Chromium, which is what
 * plays it for the user: what its code threw and logged comes back in
 * order, a picture with nothing in it reads as empty, a time past its end
 * draws its end, a preset's pictures hold what it draws, and how much of
 * a picture is painted solid tells a scene from something set over the
 * video.
 */

const STUDIO_SRC = resolve(__dirname, '../../..');
const FIXTURE_ID = 'graphic-check-fixture';
const ORIGIN = 'http://editor.test';

/** A report as it crosses back from the page: each picture's size in place of the picture, which is closed there. */
interface CheckedReport {
  readonly opened: boolean;
  readonly openError: string | null;
  readonly frames: Array<{ sec: number; size: [number, number] | null; drawnShare: number; paintedShare: number; error: string | null }>;
  readonly messages: GraphicMessage[];
}

let browser: Browser;
let page: Page;

beforeAll(async () => {
  browser = await chromium.launch();
  const bundle = await bundleForThePage();
  page = await browser.newPage();
  await page.route(`${ORIGIN}/**`, (route) => route.fulfill({ contentType: 'text/html', body: '<!doctype html><body></body>' }));
  await page.goto(`${ORIGIN}/`);
  await page.addScriptTag({ content: bundle });
  await page.addScriptTag({ content: CHECK_HELPER });
}, 120_000);

afterAll(async () => { await browser.close(); });

const CHECK_HELPER = `
window.check = async (graphic, stage, times) => {
  const players = new fixture.SandboxedGraphicPlayerFactory(document.body, new fixture.SandboxedGraphicPage(), { build: async () => '' });
  const report = await new fixture.GraphicCheck(players).check(graphic, stage, times, new AbortController().signal);
  const frames = report.frames.map(({ sec, bitmap, drawnShare, paintedShare, error }) => {
    const size = bitmap === null ? null : [bitmap.width, bitmap.height];
    bitmap?.close();
    return { sec, size, drawnShare, paintedShare, error };
  });
  return { opened: report.opened, openError: report.openError, frames, messages: report.messages };
};
// Read in the page, as the editor reads it: under Node a preset's CSS loads as nothing.
window.starter = () => new fixture.BuiltinGraphicPresetCatalog().starter().graphic;
`;

function fixturePlugin(): Plugin {
  const fixture = `\0${FIXTURE_ID}`;
  return {
    name: 'graphic-check-fixture',
    resolveId: (id) => (id === FIXTURE_ID ? fixture : null),
    load: (id) => (id === fixture
      ? `export { GraphicCheck } from '@core/graphics/services/GraphicCheck';
export { SandboxedGraphicPlayerFactory } from '@core/graphics/infrastructure/sandbox/SandboxedGraphicPlayerFactory';
export { SandboxedGraphicPage } from '@core/graphics/infrastructure/sandbox/SandboxedGraphicPage';
export { BuiltinGraphicPresetCatalog } from '@core/graphics/infrastructure/BuiltinGraphicPresetCatalog';`
      : null),
  };
}

async function bundleForThePage(): Promise<string> {
  const result = await build({
    configFile: false,
    logLevel: 'error',
    plugins: [fixturePlugin()],
    resolve: { alias: { '@core': resolve(STUDIO_SRC, 'core') } },
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

function check(graphic: GraphicDocument, stage: GraphicStage, times: number[]): Promise<CheckedReport> {
  return page.evaluate(
    ([graphic, stage, times]) => (window as unknown as { check: (...args: unknown[]) => Promise<CheckedReport> }).check(graphic, stage, times),
    [graphic, stage, times] as const,
  );
}

describe('a graphic checked once', () => {
  it('reports what its code logged and threw as it started, and pictures with nothing in them, a time past its end drawn as its end', async () => {
    const graphic = { html: '<div class="empty"></div>', css: '', js: 'console.log("starting"); throw new Error("boom");' };
    const stage = { widthPx: 200, heightPx: 100, fps: 30, seed: 1, durationSec: 2, params: {} };

    const report = await check(graphic, stage, [99, 0.5, -1]);

    expect(report.opened).toBe(true);
    expect(report.messages).toEqual([
      { level: 'log', text: 'starting' },
      { level: 'error', text: expect.stringContaining('boom') },
    ]);
    expect(report.frames).toEqual([
      { sec: 0, size: [200, 100], drawnShare: 0, paintedShare: 0, error: null },
      { sec: 0.5, size: [200, 100], drawnShare: 0, paintedShare: 0, error: null },
      { sec: 2, size: [200, 100], drawnShare: 0, paintedShare: 0, error: null },
    ]);
  });

  it('draws a preset\'s pictures at the size of its box, saying nothing wrong', async () => {
    const graphic = await page.evaluate(() => (window as unknown as { starter: () => Graphic }).starter());
    const params = Object.fromEntries(graphic.fields.map((field) => [field.id, field.defaultValue]));
    const stage = { widthPx: 864, heightPx: Math.round(864 / graphic.aspectRatio), fps: 30, seed: 1, durationSec: 3, params };

    const report = await check(graphic.document, stage, [0.6, 1.5]);

    expect(report.messages.filter(({ level }) => level !== 'log')).toEqual([]);
    expect(report.frames.map(({ size, error }) => [size, error])).toEqual([[[stage.widthPx, stage.heightPx], null], [[stage.widthPx, stage.heightPx], null]]);
    expect(report.frames.every(({ drawnShare }) => drawnShare > 0.01), report.frames.map(({ drawnShare }) => drawnShare).join(', ')).toBe(true);
  });

  it('tells a page painted solid from one that sets a small mark over the video, and from a see-through wash', async () => {
    const stage = { widthPx: 200, heightPx: 100, fps: 30, seed: 1, durationSec: 2, params: {} };
    const scene = { html: '<p>Scene</p>', css: 'html, body { margin: 0; height: 100%; background: #123456; }', js: '' };
    const mark = { html: '<div class="mark"></div>', css: 'body { margin: 0; } .mark { width: 40px; height: 20px; background: #fff; }', js: '' };
    const wash = { html: '', css: 'html, body { margin: 0; height: 100%; background: rgba(0, 0, 0, 0.4); }', js: '' };

    const painted = await check(scene, stage, [1]);
    const marked = await check(mark, stage, [1]);
    const washed = await check(wash, stage, [1]);

    expect(painted.frames[0]?.paintedShare).toBe(1);
    expect(marked.frames[0]?.paintedShare).toBeCloseTo(0.04, 2);
    expect(washed.frames[0]).toMatchObject({ drawnShare: 1, paintedShare: 0 });
  });
});

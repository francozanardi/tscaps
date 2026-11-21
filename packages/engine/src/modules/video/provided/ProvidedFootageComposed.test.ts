import { resolve } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { chromium, type Browser, type Page } from '@playwright/test';
import { build, type Plugin } from 'vite';

/**
 * A layer whose pictures the caller provides, composed into the frames
 * an export writes, in Chromium.
 *
 * The promises: each frame shows the picture the provider drew for that
 * moment of the layer's own time, counted from `sourceStartSec` where its
 * stretch starts; what it leaves transparent shows the layers beneath;
 * and its provider is opened where the stretch starts and closed once
 * it ends.
 */

const FIXTURE_ID = 'virtual:provided-footage-fixture';
const FIXTURE_SOURCE = `
  export { MediaBunnyFootageFrameComposer } from '@modules/video/mediabunny/footage/MediaBunnyFootageFrameComposer';
  export { MediaBunnyFootageOpener } from '@modules/video/mediabunny/footage/MediaBunnyFootageOpener';
  export { RetainedVideoFrame } from '@modules/video/mediabunny/frame/RetainedVideoFrame';
  export { CanvasFootageCompositor } from '@modules/video/CanvasFootageCompositor';
  export { CanvasFilterFootageGrader } from '@modules/video/grade/CanvasFilterFootageGrader';
  export { FootageGradeMath } from '@modules/video/grade/FootageGradeMath';
  export { CssFootageLayerResolverFactory } from '@modules/video/stage/CssFootageLayerResolverFactory';
  export { ComputedFootageLayerStateReader } from '@modules/video/stage/ComputedFootageLayerStateReader';
  export { FootageStageBaselineCss } from '@modules/video/stage/FootageStageBaselineCss';
  export { CssFootageLayerClockFactory } from '@modules/video/stage/CssFootageLayerClockFactory';
  export { CssFootageClockUseInspector } from '@modules/video/stage/CssFootageClockUseInspector';
`;

/** What composing one run gave: the colour at each point asked, per moment asked, and what the provider saw. */
interface Composed {
  readonly colors: number[][][];
  readonly asked: number[];
  readonly opened: number;
  readonly closed: number;
}

let browser: Browser;
let page: Page;

beforeAll(async () => {
  browser = await chromium.launch();
  const bundle = await bundleForThePage();
  page = await browser.newPage();
  await page.setContent('<!doctype html><body></body>');
  await page.addScriptTag({ content: bundle });
  await page.addScriptTag({ content: COMPOSE_HELPER });
}, 120_000);

afterAll(async () => { await browser.close(); });

// A blue source under a green image layer over the whole run, and above both a provided layer over
// [1, 3) from its own 0.5 s, transparent but for a red square whose left is 20 px per second of its time.
// Its pictures step twice a second: every time within a half second draws the same one.
const COMPOSE_HELPER = `
window.compose = async (moments, points) => {
  const SIZE = 100;
  const green = new OffscreenCanvas(SIZE, SIZE);
  const greenContext = green.getContext('2d');
  greenContext.fillStyle = '#00ff00';
  greenContext.fillRect(0, 0, SIZE, SIZE);
  const greenBlob = await green.convertToBlob({ type: 'image/png' });

  const seen = { asked: [], opened: 0, closed: 0 };
  const provider = {
    open: async () => {
      seen.opened += 1;
      return {
        width: SIZE,
        height: SIZE,
        pictureAt: async (sourceSec) => {
          seen.asked.push(sourceSec);
          const canvas = new OffscreenCanvas(SIZE, SIZE);
          const context = canvas.getContext('2d');
          context.fillStyle = '#ff0000';
          context.fillRect(Math.round(sourceSec * 20), 0, 10, 10);
          return canvas.transferToImageBitmap();
        },
        frameOf: (sourceSec) => Math.floor(sourceSec * 2),
        close: () => { seen.closed += 1; },
      };
    },
  };
  const layers = [
    { id: 'image', source: { kind: 'image', blob: greenBlob }, outputStartSec: 0, outputEndSec: 4, sourceStartSec: 0, sourcePassSec: Infinity },
    { id: 'provided', source: { kind: 'provided', provider }, outputStartSec: 1, outputEndSec: 3, sourceStartSec: 0.5, sourcePassSec: Infinity },
  ];
  const composer = new fixture.MediaBunnyFootageFrameComposer(
    layers,
    { css: '', frameWidth: SIZE, frameHeight: SIZE },
    new fixture.CssFootageLayerResolverFactory(
      new fixture.ComputedFootageLayerStateReader(),
      new fixture.FootageStageBaselineCss(),
      new fixture.CssFootageLayerClockFactory(new fixture.CssFootageClockUseInspector()),
    ),
    new fixture.MediaBunnyFootageOpener({ open: () => Promise.reject(new Error('No GIF here')) }),
    new fixture.CanvasFootageCompositor(new fixture.CanvasFilterFootageGrader(new fixture.FootageGradeMath())),
    undefined,
  );
  await composer.open(SIZE, SIZE, SIZE, SIZE);
  const colors = [];
  for (const outputSec of moments) {
    const source = fixture.RetainedVideoFrame.paintedBy(SIZE, SIZE, { timestamp: outputSec, duration: 1 / 30 }, (context) => {
      context.fillStyle = '#0000ff';
      context.fillRect(0, 0, SIZE, SIZE);
    });
    const composed = await composer.frameFor(outputSec, source);
    const canvas = new OffscreenCanvas(SIZE, SIZE);
    const context = canvas.getContext('2d');
    (composed.frame ?? source).draw(context, 0, 0, SIZE, SIZE);
    colors.push(points.map(([x, y]) => Array.from(context.getImageData(x, y, 1, 1).data)));
    composed.frame?.close();
    composed.beneathBackdrops?.frame.close();
    source.close();
  }
  await composer.close();
  return { colors, ...seen };
};
`;

function fixturePlugin(): Plugin {
  const resolved = `\0${FIXTURE_ID}`;
  return {
    name: 'provided-footage-fixture',
    resolveId: (id) => (id === FIXTURE_ID ? resolved : null),
    load: (id) => (id === resolved ? FIXTURE_SOURCE : null),
  };
}

async function bundleForThePage(): Promise<string> {
  const result = await build({
    configFile: false,
    logLevel: 'error',
    plugins: [fixturePlugin()],
    resolve: { alias: { '@modules': resolve(import.meta.dirname, '../..') } },
    build: {
      write: false,
      minify: false,
      rollupOptions: {
        input: FIXTURE_ID,
        // An app build tree-shakes an entry's exports away, and this entry is nothing but exports.
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

function compose(moments: number[], points: Array<[number, number]>): Promise<Composed> {
  return page.evaluate(
    ([moments, points]) => (window as unknown as { compose: (...args: unknown[]) => Promise<Composed> }).compose(moments, points),
    [moments, points] as const,
  );
}

const RED = [255, 0, 0, 255];
const GREEN = [0, 255, 0, 255];

describe('a layer whose pictures are provided', () => {
  it('shows the picture drawn for each moment of its own time, over the layers beneath it', async () => {
    // Its own time is 0.5 s at its start: 1 s at 1.5 s of the output (left 20 px), 2 s at 2.5 s (left 40 px).
    const { colors, asked } = await compose([1.5, 2.5], [[25, 5], [45, 5], [5, 50]]);

    expect(asked).toEqual([1, 2]);
    expect(colors[0]).toEqual([RED, GREEN, GREEN]);
    expect(colors[1]).toEqual([GREEN, RED, GREEN]);
  });

  it('keeps the picture it holds for every moment that picture stands for, and draws again only for the next', async () => {
    // Its own time is 1 s, 1.2 s and 1.6 s: the first two are one picture (left 20 px), the third the next (left 32 px).
    const { colors, asked } = await compose([1.5, 1.7, 2.1], [[25, 5], [37, 5]]);

    expect(asked).toEqual([1, 1.6]);
    expect(colors[0]).toEqual([RED, GREEN]);
    expect(colors[1]).toEqual([RED, GREEN]);
    expect(colors[2]).toEqual([GREEN, RED]);
  });

  it('is opened for its stretch alone and closed once the stretch ends', async () => {
    const { colors, asked, opened, closed } = await compose([0.5, 1.5, 3.5], [[25, 5]]);

    expect(colors).toEqual([[GREEN], [RED], [GREEN]]);
    expect(asked).toEqual([1]);
    expect(opened).toBe(1);
    expect(closed).toBe(1);
  });
});

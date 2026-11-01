import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { resolve } from 'node:path';
import { chromium, firefox, type Browser, type BrowserType } from '@playwright/test';
import { build, type Plugin } from 'vite';

/**
 * The video-frame layer of a caption, rendered through the real
 * renderer in both engines the export runs in, paints the frame it was
 * cut from exactly where that frame is: wherever the layer covers, the
 * caption's raster is the frame beneath it, pixel for pixel. A layer
 * placed off by any amount paints the frame displaced, which a frame
 * that changes on every pixel shows.
 *
 * The cases are the ways the segment's box can differ from the box the
 * caption is anchored by: a declared padding grows it past that box,
 * and how far on each side decides where the anchor lands. And the
 * layer covers the whole caption from the first one on, set in a face
 * the style brings, which no page has loaded before the render opens.
 *
 * Both markups the layer can take are held to it: the background the
 * baseline rule paints, which these engines get, and the synchronously
 * decoded image WebKit gets instead. Neither engine here is WebKit, so
 * the cases force the image.
 */

const FIXTURE_ID = 'virtual:video-frame-layer-fixture';
const FIXTURE_SOURCE = `
  export { BrowserSubtitleFrameRenderer } from '@modules/rendering/BrowserSubtitleFrameRenderer';
  export { Document } from '@modules/document/Document';
  export { Section } from '@modules/document/Section';
  export { Segment } from '@modules/document/Segment';
  export { Line } from '@modules/document/Line';
  export { Word } from '@modules/document/Word';
  export { TimeFragment } from '@modules/document/TimeFragment';
  export { ElementRenderOverrides } from '@modules/rendering/types/ElementRenderOverrides';
  export { GraphemeWordSplitter } from '@modules/splitting/GraphemeWordSplitter';
  export { BackgroundVideoFrameLayerMarkup } from '@modules/rendering/subtitle/BackgroundVideoFrameLayerMarkup';
  export { DecodedImageVideoFrameLayerMarkup } from '@modules/rendering/subtitle/DecodedImageVideoFrameLayerMarkup';
  export { WebKitDetector } from '@modules/rendering/subtitle/WebKitDetector';
`;

const WIDTH = 400;
const HEIGHT = 300;

/** Words that take room and paint nothing, so the layer is all the caption paints. */
const CSS = `
  .segment { font-size: 16px; }
  .line { display: flex; column-gap: 12px; }
  .word { display: inline-block; width: 40px; height: 24px; color: transparent; font-size: 10px; }
`;

/**
 * A face whose "W" is a solid box one and a half em wide, far wider than
 * in any fallback face. Three glyphs (.notdef, space, W), built with
 * fontTools' FontBuilder.
 */
const WIDE_FONT_BASE64 = 'AAEAAAAKAIAAAwAgT1MvMkUAROEAAAEoAAAAYGNtYXAAoABGAAABlAAAADxnbHlmJos6EAAAAdgAAAAYaGVhZDL5/RIAAACsAAAANmhoZWEI/gUYAAAA5AAAACRobXR4CMoAAAAAAYgAAAAMbG9jYQAAAAwAAAHQAAAACG1heHAABQAGAAABCAAAACBuYW1lVUNrzQAAAfAAAABgcG9zdAAIADoAAAJQAAAAKAABAAAAAQAAmRzBqV8PPPUAAwPoAAAAAOcD3LsAAAAA5wPcuwAAAAAF3AK8AAAAAwACAAAAAAAAAAEAAAMg/zgAAAXcAAAAAAXcAAEAAAAAAAAAAAAAAAAAAAADAAEAAAADAAQAAQAAAAAAAgAAAAAAAAAAAAAAAAAAAAAAAwLuAZAABQAEAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABAAAAAAAAAAAAAAAAPz8/PwAAACAAVwMg/zgAAAMgAMgAAAAAAAAAAAAAAAAAAAAgAAAB9AAAAPoAAAXcAAAAAAACAAAAAwAAABQAAwABAAAAFAAEACgAAAAGAAQAAQACACAAV///AAAAIABX////4f+rAAEAAAAAAAAAAAAAAAAADAABAAAAAAXcArwAAwAAMREhEQXcArz9RAAAAAQANgABAAAAAAABAAcAAAABAAAAAAACAAcABwADAAEECQABAA4ADgADAAEECQACAA4AHFdpZGVCb3hSZWd1bGFyAFcAaQBkAGUAQgBvAHgAUgBlAGcAdQBsAGEAcgACAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAMAAAADADo=';

/** One caption in the wide face whose text paints nothing, and the same caption's box painted green. */
const WIDE_FONT_CSS = `
  @font-face { font-family: "wide-box"; src: url(data:font/ttf;base64,${WIDE_FONT_BASE64}) format("truetype"); }
  .segment { font-family: "wide-box", monospace; font-size: 20px; line-height: 1; }
  .word { color: transparent; }
`;
const MARKED_BOX_CSS = `${WIDE_FONT_CSS} .segment { background: rgb(0, 255, 0); }`;

interface Case {
  readonly name: string;
  readonly padding: { top: string; right: string; bottom: string; left: string } | null;
  readonly verticalAlign: 'top' | 'center' | 'bottom';
  readonly horizontalAlign: 'left' | 'center' | 'right';
}

const UNEVEN = { top: '3em', right: '2em', bottom: '1em', left: '1em' };

const CASES: ReadonlyArray<Case> = [
  { name: 'no padding', padding: null, verticalAlign: 'bottom', horizontalAlign: 'center' },
  { name: 'a padding, anchored at the bottom', padding: UNEVEN, verticalAlign: 'bottom', horizontalAlign: 'center' },
  { name: 'a padding, anchored at the top', padding: UNEVEN, verticalAlign: 'top', horizontalAlign: 'center' },
  { name: 'a padding, anchored at the left', padding: UNEVEN, verticalAlign: 'center', horizontalAlign: 'left' },
  { name: 'a padding, anchored at the right', padding: UNEVEN, verticalAlign: 'center', horizontalAlign: 'right' },
  { name: 'a padding with sides of a bare zero', padding: { top: '2.5em', right: '0', bottom: '0', left: '1.5em' }, verticalAlign: 'bottom', horizontalAlign: 'center' },
];

/** The layer markup the renderer is given: `null` leaves it the default for the engine. */
type LayerMarkup = 'background' | 'decoded-image' | null;

interface Verdict {
  /** Pixels the layer paints, away from its edges. */
  covered: number;
  /** Of those, how many differ from the frame at the same place. */
  displaced: number;
}

let bundle: string;

beforeAll(async () => { bundle = await bundleForThePage(); }, 120_000);

function fixtureModulePlugin(): Plugin {
  const resolved = `\0${FIXTURE_ID}`;
  return {
    name: 'video-frame-layer-fixture',
    resolveId: (id) => (id === FIXTURE_ID ? resolved : null),
    load: (id) => (id === resolved ? FIXTURE_SOURCE : null),
  };
}

async function bundleForThePage(): Promise<string> {
  const result = await build({
    configFile: false,
    logLevel: 'error',
    plugins: [fixtureModulePlugin()],
    resolve: { alias: { '@modules': resolve(import.meta.dirname, '../..') } },
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

async function verdictIn(browser: Browser, testCase: Case, markup: LayerMarkup): Promise<Verdict> {
  const page = await browser.newPage();
  try {
    await page.setContent('<!doctype html><html><head></head><body></body></html>');
    await page.addScriptTag({ content: bundle });
    return await page.evaluate(async ({ testCase, css, width, height, markup }) => {
      type Ctor = new (...args: never[]) => unknown;
      const f = (window as unknown as { fixture: Record<string, Ctor> & {
        BrowserSubtitleFrameRenderer: { create: (...args: unknown[]) => {
          open: (...args: unknown[]) => Promise<void>;
          getFrames: (t: number[]) => Promise<Array<{ draw: (...args: unknown[]) => void } | null>>;
          close: () => void;
        } };
        ElementRenderOverrides: { fromEntries: (entries: unknown[]) => unknown };
      } }).fixture;
      const make = <T,>(name: string, ...args: unknown[]): T => new (f[name] as unknown as new (...a: unknown[]) => T)(...args);

      // A triangle wave on each axis: every pixel differs from its
      // neighbours, and no edge is sharp enough to make resampling a
      // false alarm.
      const triangle = (value: number, halfPeriod: number): number => {
        const phase = (value % (2 * halfPeriod)) / halfPeriod;
        return Math.round(255 * (phase <= 1 ? phase : 2 - phase));
      };
      const frame = document.createElement('canvas');
      frame.width = width;
      frame.height = height;
      const frameContext = frame.getContext('2d')!;
      const pixels = frameContext.createImageData(width, height);
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const i = (y * width + x) * 4;
          pixels.data[i] = triangle(x, 32);
          pixels.data[i + 1] = triangle(y, 24);
          pixels.data[i + 2] = triangle(x + y, 40);
          pixels.data[i + 3] = 255;
        }
      }
      frameContext.putImageData(pixels, 0, 0);
      const frameSource = {
        getFrameAt: (_t: number, _quality: number, region?: { x: number; y: number; width: number; height: number }) => {
          const crop = region ?? { x: 0, y: 0, width, height };
          const slice = document.createElement('canvas');
          slice.width = crop.width;
          slice.height = crop.height;
          slice.getContext('2d')!.drawImage(frame, crop.x, crop.y, crop.width, crop.height, 0, 0, crop.width, crop.height);
          return Promise.resolve(slice.toDataURL('image/png'));
        },
      };

      const words = ['w1', 'w2', 'w3'].map((id, i) => make('Word', {
        id, text: `w${i}`, time: make('TimeFragment', i / 3, (i + 1) / 3),
      }));
      const doc = make('Document', {
        sections: [make('Section', {
          id: 'section', kind: 'main',
          segments: [make('Segment', { id: 's1', lines: [make('Line', { id: 'l1', words })] })],
        })],
      });
      const renderer = f.BrowserSubtitleFrameRenderer.create(
        { embed: (text: string) => Promise.resolve(text) }, make('GraphemeWordSplitter'),
        markup === null ? {} : { videoFrameLayerMarkup: make(markup === 'background' ? 'BackgroundVideoFrameLayerMarkup' : 'DecodedImageVideoFrameLayerMarkup') },
      );
      await renderer.open(doc, {
        main: {
          css,
          inlineStyles: {},
          alignment: {
            verticalAlign: testCase.verticalAlign,
            verticalOffset: 0.5,
            horizontalAlign: testCase.horizontalAlign,
            horizontalOffset: 0.5,
          },
          rendering: {
            splitWordsIntoLetters: false,
            videoFrame: { required: true, jpegQuality: 0.8 },
            padding: testCase.padding,
            textDirection: 'ltr',
          },
          segmentOverrides: f.ElementRenderOverrides.fromEntries([]),
          subtreeOverrides: f.ElementRenderOverrides.fromEntries([]),
        },
      }, width, height, frameSource);
      const [caption] = await renderer.getFrames([0.5]);
      const out = document.createElement('canvas');
      out.width = width;
      out.height = height;
      const context = out.getContext('2d')!;
      caption?.draw(context, 0, 0, width, height);
      renderer.close();
      const painted = context.getImageData(0, 0, width, height);

      const opaque = (x: number, y: number): boolean =>
        x >= 0 && y >= 0 && x < width && y < height && painted.data[(y * width + x) * 4 + 3]! >= 250;
      const TOLERANCE = 8;
      let covered = 0;
      let displaced = 0;
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          if (!opaque(x - 1, y - 1) || !opaque(x + 1, y - 1) || !opaque(x - 1, y + 1) || !opaque(x + 1, y + 1)) continue;
          covered++;
          const i = (y * width + x) * 4;
          for (let c = 0; c < 3; c++) {
            if (Math.abs(painted.data[i + c]! - pixels.data[i + c]!) > TOLERANCE) { displaced++; break; }
          }
        }
      }
      return { covered, displaced };
    }, { testCase, css: CSS, width: WIDTH, height: HEIGHT, markup });
  } finally {
    await page.close();
  }
}

interface Coverage {
  /** Pixels of the caption's box, away from its edges. */
  box: number;
  /** Of those, how many the layer leaves uncovered. */
  uncovered: number;
}

/**
 * Renders a caption set in the wide face twice in a fresh page: once
 * with only its frame layer painting, once with its box painted green.
 * The layer must cover the whole box.
 */
async function coverageIn(browser: Browser, markup: LayerMarkup): Promise<Coverage> {
  const page = await browser.newPage();
  try {
    await page.setContent('<!doctype html><html><head></head><body></body></html>');
    await page.addScriptTag({ content: bundle });
    return await page.evaluate(async ({ layerCss, boxCss, width, height, markup }) => {
      type Ctor = new (...args: never[]) => unknown;
      const f = (window as unknown as { fixture: Record<string, Ctor> & {
        BrowserSubtitleFrameRenderer: { create: (...args: unknown[]) => {
          open: (...args: unknown[]) => Promise<void>;
          getFrames: (t: number[]) => Promise<Array<{ draw: (...args: unknown[]) => void } | null>>;
          close: () => void;
        } };
        ElementRenderOverrides: { fromEntries: (entries: unknown[]) => unknown };
      } }).fixture;
      const make = <T,>(name: string, ...args: unknown[]): T => new (f[name] as unknown as new (...a: unknown[]) => T)(...args);

      const frame = document.createElement('canvas');
      frame.width = width;
      frame.height = height;
      const frameContext = frame.getContext('2d')!;
      frameContext.fillStyle = 'rgb(128, 128, 128)';
      frameContext.fillRect(0, 0, width, height);
      const frameSource = {
        getFrameAt: (_t: number, _quality: number, region?: { x: number; y: number; width: number; height: number }) => {
          const crop = region ?? { x: 0, y: 0, width, height };
          const slice = document.createElement('canvas');
          slice.width = crop.width;
          slice.height = crop.height;
          slice.getContext('2d')!.drawImage(frame, crop.x, crop.y, crop.width, crop.height, 0, 0, crop.width, crop.height);
          return Promise.resolve(slice.toDataURL('image/png'));
        },
      };
      const doc = make('Document', {
        sections: [make('Section', {
          id: 'section', kind: 'main',
          segments: [make('Segment', { id: 's1', lines: [make('Line', { id: 'l1', words: [
            make('Word', { id: 'w1', text: 'WWW', time: make('TimeFragment', 0, 1) }),
          ] })] })],
        })],
      });

      const render = async (css: string, withFrame: boolean): Promise<ImageData> => {
        const renderer = f.BrowserSubtitleFrameRenderer.create(
          { embed: (text: string) => Promise.resolve(text) }, make('GraphemeWordSplitter'),
          markup === null ? {} : { videoFrameLayerMarkup: make(markup === 'background' ? 'BackgroundVideoFrameLayerMarkup' : 'DecodedImageVideoFrameLayerMarkup') },
        );
        await renderer.open(doc, {
          main: {
            css,
            inlineStyles: {},
            alignment: { verticalAlign: 'center', verticalOffset: 0.5, horizontalAlign: 'center', horizontalOffset: 0.5 },
            rendering: {
              splitWordsIntoLetters: false,
              videoFrame: { required: withFrame, jpegQuality: 0.8 },
              padding: null,
              textDirection: 'ltr',
            },
            segmentOverrides: f.ElementRenderOverrides.fromEntries([]),
            subtreeOverrides: f.ElementRenderOverrides.fromEntries([]),
          },
        }, width, height, withFrame ? frameSource : undefined);
        const [caption] = await renderer.getFrames([0.5]);
        const out = document.createElement('canvas');
        out.width = width;
        out.height = height;
        const context = out.getContext('2d')!;
        caption?.draw(context, 0, 0, width, height);
        renderer.close();
        return context.getImageData(0, 0, width, height);
      };

      const layer = await render(layerCss, true);
      const marked = await render(boxCss, false);

      const isBox = (x: number, y: number): boolean => {
        if (x < 0 || y < 0 || x >= width || y >= height) return false;
        const i = (y * width + x) * 4;
        return marked.data[i + 1]! > 200 && marked.data[i]! < 60 && marked.data[i + 2]! < 60 && marked.data[i + 3]! > 250;
      };
      let box = 0;
      let uncovered = 0;
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          if (!isBox(x, y) || !isBox(x - 1, y) || !isBox(x + 1, y) || !isBox(x, y - 1) || !isBox(x, y + 1)) continue;
          box++;
          if (layer.data[(y * width + x) * 4 + 3]! < 250) uncovered++;
        }
      }
      return { box, uncovered };
    }, { layerCss: WIDE_FONT_CSS, boxCss: MARKED_BOX_CSS, width: WIDTH, height: HEIGHT, markup });
  } finally {
    await page.close();
  }
}

/** Whether the host the renderer runs in, opened in a fresh page, is taken for WebKit. */
async function takenForWebKitIn(browser: Browser): Promise<boolean> {
  const page = await browser.newPage();
  try {
    await page.setContent('<!doctype html><html><head></head><body></body></html>');
    await page.addScriptTag({ content: bundle });
    return await page.evaluate(() => {
      const f = (window as unknown as { fixture: {
        WebKitDetector: new (navigator: Navigator) => { isWebKit: () => boolean };
      } }).fixture;
      return new f.WebKitDetector(navigator).isWebKit();
    });
  } finally {
    await page.close();
  }
}

const MARKUPS: ReadonlyArray<[string, LayerMarkup]> = [
  ['the markup the engine gets', null],
  ['the decoded-image markup', 'decoded-image'],
];

describe.each<[string, BrowserType]>([['chromium', chromium], ['firefox', firefox]])('in %s', (_, engine) => {
  let browser: Browser;

  beforeAll(async () => { browser = await engine.launch(); }, 60_000);
  afterAll(async () => { await browser.close(); });

  it('is not taken for WebKit, so it keeps the background markup', async () => {
    expect(await takenForWebKitIn(browser)).toBe(false);
  }, 30_000);

  describe.each(MARKUPS)('with %s', (_name, markup) => {
    it.each(CASES.map((testCase) => [testCase.name, testCase] as const))('paints the frame where it is with %s', async (_name, testCase) => {
      const verdict = await verdictIn(browser, testCase, markup);
      expect(verdict.covered).toBeGreaterThan(2000);
      expect(verdict.displaced).toBe(0);
    }, 30_000);

    it('covers a caption set in a face the style brings, from the first caption', async () => {
      const coverage = await coverageIn(browser, markup);
      expect(coverage.box).toBeGreaterThan(500);
      expect(coverage.uncovered).toBe(0);
    }, 30_000);
  });
});

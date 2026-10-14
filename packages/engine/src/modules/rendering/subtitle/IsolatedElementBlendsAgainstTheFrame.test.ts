import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { resolve } from 'node:path';
import { chromium, firefox, type Browser, type BrowserType } from '@playwright/test';
import { build, type Plugin } from 'vite';

/**
 * An element blended with `difference`, rendered through the real
 * renderer — one per caption layer — and composited onto the frame by
 * the real compositor, in both engines the export runs in.
 *
 * Only a CSS engine can say where a copy of a subtree paints, so the
 * oracle is the picture. Each case renders the same caption three
 * times: with the element blended, with the element marked in a flat
 * colour (to find where it paints), and with the element hidden (what
 * lies beneath it). Where the element paints, the isolated picture must
 * be the difference of white against what lies beneath; everywhere
 * else it must be exactly what lies beneath — which is what catches a
 * copy painting a background or a neighbour a second time.
 *
 * The cases are the ways a stylesheet can put a stacking context
 * between an element and the frame, each of which cuts a blend written
 * on the element itself.
 */

const FIXTURE_ID = 'virtual:isolated-element-fixture';
const FIXTURE_SOURCE = `
  export { BrowserSubtitleFrameRenderer } from '@modules/rendering/BrowserSubtitleFrameRenderer';
  export { Document } from '@modules/document/Document';
  export { Section } from '@modules/document/Section';
  export { Segment } from '@modules/document/Segment';
  export { Line } from '@modules/document/Line';
  export { Word } from '@modules/document/Word';
  export { Decoration } from '@modules/document/Decoration';
  export { TimeFragment } from '@modules/document/TimeFragment';
  export { ElementRenderOverrides } from '@modules/rendering/types/ElementRenderOverrides';
  export { GraphemeWordSplitter } from '@modules/splitting/GraphemeWordSplitter';
  export { CaptionStacking } from '@modules/rendering/types/CaptionStacking';
  export { CaptionBlendMode } from '@modules/rendering/types/CaptionBlendMode';
  export { CaptionLayer } from '@modules/rendering/types/CaptionLayer';
  export { LayeredFrameCompositor } from '@modules/video/mediabunny/frame/LayeredFrameCompositor';
`;

const WIDTH = 400;
const HEIGHT = 300;

const BLOCKS_CSS = `
  .line { display: flex; column-gap: 12px; }
  .word { display: inline-block; width: 40px; height: 24px; background: #fff; color: transparent; font-size: 10px; }
  .word-decoration { width: 20px; height: 20px; background: #fff; color: transparent; }
  @keyframes travel { from { transform: translate(0, 0); } to { transform: translate(30px, 50px); } }
  @keyframes fade { from { opacity: 0; } to { opacity: 1; } }
  @keyframes gone { from { visibility: hidden; } to { visibility: hidden; } }
`;

interface Case {
  readonly name: string;
  /** Declarations on `.segment`. */
  readonly segmentCss: string;
  /** Extra rules, unscoped by the case. */
  readonly extraCss?: string;
  /** Which element is isolated. */
  readonly isolate: 'word' | 'glyph-below' | 'glyph-inline';
  readonly splitWordsIntoLetters?: boolean;
  /**
   * Paints the caption over a top layer covering the left half of the
   * frame, so the element blends against the top layer, not the video.
   */
  readonly overTopLayer?: boolean;
}

const CASES: ReadonlyArray<Case> = [
  { name: 'nothing on the segment', segmentCss: '', isolate: 'word' },
  { name: 'a translate on the segment', segmentCss: 'transform: translate(15px, 25px);', isolate: 'word' },
  { name: 'an animated transform on the segment', segmentCss: 'animation: travel 1s linear -0.5s;', isolate: 'word' },
  { name: 'an animated opacity on the segment', segmentCss: 'animation: fade 1s linear -1s;', isolate: 'word' },
  { name: 'a filter on the segment', segmentCss: 'filter: blur(0);', isolate: 'word' },
  { name: 'a rotation on the segment', segmentCss: 'rotate: 8deg;', isolate: 'word' },
  { name: 'a background on a moved segment', segmentCss: 'padding: 6px; background: rgba(255, 0, 0, 0.5); transform: translate(15px, 25px);', isolate: 'word' },
  { name: 'a segment its animation hides', segmentCss: 'animation: gone 1s linear -0.5s;', isolate: 'word' },
  {
    name: 'a word its own animation hides',
    segmentCss: 'transform: translate(15px, 25px);',
    extraCss: '.line > .word:nth-child(2) { animation: gone 1s linear -0.5s; }',
    isolate: 'word',
  },
  { name: 'a word split into letters', segmentCss: 'transform: translate(15px, 25px);', isolate: 'word', splitWordsIntoLetters: true },
  { name: 'a glyph below the line', segmentCss: 'padding: 6px 6px 30px; transform: translate(15px, 25px);', isolate: 'glyph-below' },
  { name: 'a glyph inside its word', segmentCss: 'transform: translate(15px, 25px);', isolate: 'glyph-inline' },
  // Moved left so the word lands on the top layer's half of the frame.
  { name: 'a caption over the top layer', segmentCss: 'transform: translate(-60px, 25px);', isolate: 'word', overTopLayer: true },
];

interface Verdict {
  /** Pixels where the element paints, far enough inside to be free of anti-aliasing. */
  inside: number;
  /** Of those, how many are not white differenced against what lies beneath. */
  wrongInside: number;
  /** Pixels clear of the element, which must be exactly what lies beneath. */
  wrongOutside: number;
}

let bundle: string;

beforeAll(async () => { bundle = await bundleForThePage(); }, 120_000);

function fixtureModulePlugin(): Plugin {
  const resolved = `\0${FIXTURE_ID}`;
  return {
    name: 'isolated-element-fixture',
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

async function verdictIn(browser: Browser, testCase: Case): Promise<Verdict> {
  const page = await browser.newPage();
  try {
    await page.setContent('<!doctype html><html><head></head><body></body></html>');
    await page.addScriptTag({ content: bundle });
    return await page.evaluate(async ({ testCase, css, width, height }) => {
      type Ctor = new (...args: never[]) => unknown;
      const f = (window as unknown as { fixture: Record<string, Ctor> & {
        BrowserSubtitleFrameRenderer: { create: (...args: unknown[]) => {
          open: (...args: unknown[]) => Promise<void>;
          getFrames: (t: number[]) => Promise<Array<{ draw: (...args: unknown[]) => void } | null>>;
          close: () => void;
        } };
        ElementRenderOverrides: { fromEntries: (entries: unknown[]) => unknown; empty: () => unknown };
        CaptionLayer: { of: (stacking: string, blendMode: string) => unknown };
        CaptionStacking: Record<string, string>;
        CaptionBlendMode: Record<string, string>;
      } }).fixture;
      const make = <T,>(name: string, ...args: unknown[]): T => new (f[name] as unknown as new (...a: unknown[]) => T)(...args);

      const frame = document.createElement('canvas');
      frame.width = width;
      frame.height = height;
      const frameContext = frame.getContext('2d')!;
      const pixels = frameContext.createImageData(width, height);
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const i = (y * width + x) * 4;
          pixels.data[i] = Math.round(40 + y * 0.5);
          pixels.data[i + 1] = Math.round(60 + x * 0.4);
          pixels.data[i + 2] = Math.round(200 - y * 0.4);
          pixels.data[i + 3] = 255;
        }
      }
      frameContext.putImageData(pixels, 0, 0);
      const videoFrame = {
        timestamp: 0.5,
        duration: 1,
        close: () => {},
        draw: (context: CanvasRenderingContext2D) => context.drawImage(frame, 0, 0),
      };
      // A flat colour over the left half, standing in for the actor cutout.
      const topLayer = {
        draw: (context: CanvasRenderingContext2D) => {
          context.fillStyle = 'rgb(230, 40, 120)';
          context.fillRect(0, 0, width / 2, height);
        },
      };

      const under = f.CaptionStacking.UNDER_TOP_LAYER!;
      const over = f.CaptionStacking.OVER_TOP_LAYER!;
      const side = testCase.overTopLayer ? over : under;
      const layers = [
        f.CaptionLayer.of(under, f.CaptionBlendMode.NORMAL!),
        f.CaptionLayer.of(side, f.CaptionBlendMode.NORMAL!),
        f.CaptionLayer.of(side, f.CaptionBlendMode.DIFFERENCE!),
      ].filter((layer, i, all) => all.indexOf(layer) === i);

      const glyph = testCase.isolate === 'word' ? null : make('Decoration', { id: 'g2', glyph: 'x' });
      const words = ['w1', 'w2', 'w3'].map((id, i) => make('Word', {
        id,
        text: `w${i}`,
        time: make('TimeFragment', i / 3, (i + 1) / 3),
        decoration: id === 'w2' ? glyph : null,
      }));
      const doc = make('Document', {
        sections: [make('Section', {
          id: 'section',
          kind: 'main',
          segments: [make('Segment', { id: 's1', lines: [make('Line', { id: 'l1', words })] })],
        })],
      });
      const isolatedId = testCase.isolate === 'word' ? 'w2' : 'g2';

      const renderLayer = async (layer: unknown, override: unknown): Promise<{ draw: (...args: unknown[]) => void } | null> => {
        const renderer = f.BrowserSubtitleFrameRenderer.create(
          { embed: (text: string) => Promise.resolve(text) }, make('GraphemeWordSplitter'), { layer },
        );
        await renderer.open(doc, {
          main: {
            css: `${css} .segment { ${testCase.segmentCss} } ${testCase.extraCss ?? ''}`,
            inlineStyles: {},
            alignment: { verticalAlign: 'center', verticalOffset: 0.5, horizontalAlign: 'center', horizontalOffset: 0.5 },
            rendering: {
              splitWordsIntoLetters: testCase.splitWordsIntoLetters ?? false,
              videoFrame: { required: false, jpegQuality: 0.8 },
              padding: null,
              textDirection: 'ltr',
            },
            segmentOverrides: f.ElementRenderOverrides.fromEntries(testCase.overTopLayer ? [['s1', { stacking: over }]] : []),
            subtreeOverrides: f.ElementRenderOverrides.fromEntries([[isolatedId, override]]),
            decorationPlacements: new Map(testCase.isolate === 'glyph-below' ? [['g2', 'below']] : []),
          },
        }, width, height);
        const [caption] = await renderer.getFrames([0.5]);
        renderer.close();
        return caption ?? null;
      };

      const render = async (override: unknown): Promise<ImageData> => {
        const captions = [];
        for (const layer of layers) {
          const caption = await renderLayer(layer, override);
          if (caption) captions.push({ layer, frame: caption });
        }
        const out = document.createElement('canvas');
        out.width = width;
        out.height = height;
        const context = out.getContext('2d')!;
        make<{ compose: (...args: unknown[]) => void }>('LayeredFrameCompositor').compose(context, {
          frame: videoFrame,
          captions,
          overlay: null,
          topLayer: testCase.overTopLayer ? topLayer : null,
          blendCaptions: true,
          width,
          height,
        });
        return context.getImageData(0, 0, width, height);
      };

      const isolated = await render({ blendMode: f.CaptionBlendMode.DIFFERENCE });
      const marked = await render({ inlineStyles: { background: 'rgb(0, 255, 0)' } });
      const beneath = await render({ inlineStyles: { visibility: 'hidden' } });

      const isMarked = (x: number, y: number): boolean => {
        const i = (y * width + x) * 4;
        return marked.data[i + 1]! - marked.data[i]! > 150 && marked.data[i + 1]! - marked.data[i + 2]! > 150;
      };
      const markedNear = (x: number, y: number, radius: number, every: boolean): boolean => {
        for (let dy = -radius; dy <= radius; dy++) {
          for (let dx = -radius; dx <= radius; dx++) {
            const nx = x + dx;
            const ny = y + dy;
            const hit = nx >= 0 && ny >= 0 && nx < width && ny < height && isMarked(nx, ny);
            if (every && !hit) return false;
            if (!every && hit) return true;
          }
        }
        return every;
      };
      const TOLERANCE = 6;
      let inside = 0;
      let wrongInside = 0;
      let wrongOutside = 0;
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const i = (y * width + x) * 4;
          if (markedNear(x, y, 2, true)) {
            inside++;
            for (let c = 0; c < 3; c++) {
              if (Math.abs(isolated.data[i + c]! - (255 - beneath.data[i + c]!)) > TOLERANCE) { wrongInside++; break; }
            }
          } else if (!markedNear(x, y, 2, false)) {
            for (let c = 0; c < 3; c++) {
              if (Math.abs(isolated.data[i + c]! - beneath.data[i + c]!) > TOLERANCE) { wrongOutside++; break; }
            }
          }
        }
      }
      return { inside, wrongInside, wrongOutside };
    }, { testCase, css: BLOCKS_CSS, width: WIDTH, height: HEIGHT });
  } finally {
    await page.close();
  }
}

/** Where each side of the top layer painted, read as how many pixels of each word it covered. */
interface SideReading {
  readonly isolatedWordUnder: number;
  readonly otherWordsUnder: number;
  readonly isolatedWordOver: number;
  readonly otherWordsOver: number;
}

/**
 * Renders a caption whose segment paints over the top layer while one of
 * its words paints under it, once per side, and reads which words each
 * side covered. The segment carries a translate, so the word's copy only
 * lands on the word if the copy is laid out as the original.
 */
async function sidesIn(browser: Browser): Promise<SideReading> {
  const page = await browser.newPage();
  try {
    await page.setContent('<!doctype html><html><head></head><body></body></html>');
    await page.addScriptTag({ content: bundle });
    return await page.evaluate(async ({ css, width, height }) => {
      type Ctor = new (...args: never[]) => unknown;
      const f = (window as unknown as { fixture: Record<string, Ctor> & {
        BrowserSubtitleFrameRenderer: { create: (...args: unknown[]) => {
          open: (...args: unknown[]) => Promise<void>;
          getFrames: (t: number[]) => Promise<Array<{ draw: (...args: unknown[]) => void } | null>>;
          close: () => void;
        } };
        ElementRenderOverrides: { fromEntries: (entries: unknown[]) => unknown };
        CaptionStacking: Record<string, string>;
        CaptionBlendMode: Record<string, string>;
        CaptionLayer: { of: (stacking: string, blendMode: string) => unknown };
      } }).fixture;
      const make = <T,>(name: string, ...args: unknown[]): T => new (f[name] as unknown as new (...a: unknown[]) => T)(...args);
      const words = ['w1', 'w2', 'w3'].map((id, i) => make('Word', {
        id, text: `w${i}`, time: make('TimeFragment', i / 3, (i + 1) / 3),
      }));
      const doc = make('Document', {
        sections: [make('Section', {
          id: 'section', kind: 'main',
          segments: [make('Segment', { id: 's1', lines: [make('Line', { id: 'l1', words })] })],
        })],
      });
      const under = f.CaptionStacking.UNDER_TOP_LAYER!;
      const over = f.CaptionStacking.OVER_TOP_LAYER!;

      const render = async (stacking: string, segmentOverride: unknown, w2Override: unknown): Promise<ImageData> => {
        const layer = f.CaptionLayer.of(stacking, f.CaptionBlendMode.NORMAL!);
        const renderer = f.BrowserSubtitleFrameRenderer.create(
          { embed: (text: string) => Promise.resolve(text) }, make('GraphemeWordSplitter'), { layer },
        );
        await renderer.open(doc, {
          main: {
            css: `${css} .segment { transform: translate(15px, 25px); }`,
            inlineStyles: {},
            alignment: { verticalAlign: 'center', verticalOffset: 0.5, horizontalAlign: 'center', horizontalOffset: 0.5 },
            rendering: { splitWordsIntoLetters: false, videoFrame: { required: false, jpegQuality: 0.8 }, padding: null, textDirection: 'ltr' },
            segmentOverrides: f.ElementRenderOverrides.fromEntries(segmentOverride ? [['s1', segmentOverride]] : []),
            subtreeOverrides: f.ElementRenderOverrides.fromEntries(w2Override ? [['w2', w2Override]] : []),
          },
        }, width, height);
        const [caption] = await renderer.getFrames([0.5]);
        renderer.close();
        const out = document.createElement('canvas');
        out.width = width;
        out.height = height;
        const context = out.getContext('2d')!;
        caption?.draw(context, 0, 0, width, height);
        return context.getImageData(0, 0, width, height);
      };

      const marked = await render(under, null, { inlineStyles: { background: 'rgb(0, 255, 0)' } });
      const split = { stacking: over };
      const wordUnder = { stacking: under };
      const underPass = await render(under, split, wordUnder);
      const overPass = await render(over, split, wordUnder);

      const reading = { isolatedWordUnder: 0, otherWordsUnder: 0, isolatedWordOver: 0, otherWordsOver: 0 };
      for (let i = 0; i < marked.data.length; i += 4) {
        const alpha = marked.data[i + 3]!;
        if (alpha < 250) continue;
        const isolated = marked.data[i + 1]! - marked.data[i]! > 150;
        const paintedUnder = underPass.data[i + 3]! > 250;
        const paintedOver = overPass.data[i + 3]! > 250;
        if (isolated) {
          if (paintedUnder) reading.isolatedWordUnder++;
          if (paintedOver) reading.isolatedWordOver++;
        } else {
          if (paintedUnder) reading.otherWordsUnder++;
          if (paintedOver) reading.otherWordsOver++;
        }
      }
      return reading;
    }, { css: BLOCKS_CSS, width: WIDTH, height: HEIGHT });
  } finally {
    await page.close();
  }
}

const HIDDEN_BY_AN_ANIMATION = new Set(['a segment its animation hides', 'a word its own animation hides']);

describe.each<[string, BrowserType]>([['chromium', chromium], ['firefox', firefox]])('in %s', (_, engine) => {
  let browser: Browser;

  beforeAll(async () => { browser = await engine.launch(); }, 60_000);
  afterAll(async () => { await browser.close(); });

  it.each(CASES.map((testCase) => [testCase.name, testCase] as const))('blends against the frame with %s', async (_name, testCase) => {
    const verdict = await verdictIn(browser, testCase);
    if (HIDDEN_BY_AN_ANIMATION.has(testCase.name)) {
      expect(verdict.inside).toBe(0);
    } else {
      expect(verdict.inside).toBeGreaterThan(100);
    }
    expect(verdict).toMatchObject({ wrongInside: 0, wrongOutside: 0 });
  }, 30_000);

  // A word hidden behind the actor while the rest of its caption is not:
  // the side under the top layer must paint the word alone, the side
  // over it everything but the word.
  it('splits a caption across the two sides of the top layer', async () => {
    const reading = await sidesIn(browser);
    expect(reading.isolatedWordUnder).toBeGreaterThan(500);
    expect(reading.otherWordsOver).toBeGreaterThan(1000);
    expect(reading).toMatchObject({ isolatedWordOver: 0, otherWordsUnder: 0 });
  }, 30_000);
});

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { resolve } from 'node:path';
import { chromium, firefox, type Browser, type BrowserType } from '@playwright/test';
import { build, type Plugin } from 'vite';

/**
 * A width the renderer publishes to a stylesheet is the one layout gave
 * the box, whatever transform draws it larger or smaller. A line sized
 * from its own measured width to fill exactly 200 px of layout comes out
 * 200 px long, and is painted at whatever size its transforms make that.
 *
 * Read through the transform instead, the width would shrink with a line
 * drawn at half its size, and the line sized from it would be laid out
 * twice as long as asked.
 */

const FIXTURE_ID = 'virtual:measured-width-fixture';
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
`;

const WIDTH = 400;
const HEIGHT = 300;
const TARGET_PX = 200;

/** Three solid blocks two em wide, so the line is six em long and paints nothing but the blocks. */
const BASE_CSS = `
  .segment { font-size: 16px; line-height: 1; }
  .line { display: inline-block; font-size: calc(${TARGET_PX}px / var(--line-width-em, 1)); }
  .word { display: inline-block; width: 2em; height: 1em; margin: 0; color: transparent; background: rgb(0, 255, 0); }
`;

interface Case {
  readonly name: string;
  readonly css: string;
  /** How long the line is painted along the axis it lies on. */
  readonly paintedLength: number;
  readonly axis: 'x' | 'y';
}

const CASES: ReadonlyArray<Case> = [
  { name: 'a line drawn at half its size', css: '.line { scale: 0.5; }', paintedLength: TARGET_PX / 2, axis: 'x' },
  { name: 'a caption drawn at half its size', css: '.segment { scale: 0.5; }', paintedLength: TARGET_PX / 2, axis: 'x' },
  { name: 'a caption turned a quarter', css: '.segment { rotate: 90deg; }', paintedLength: TARGET_PX, axis: 'y' },
];

let bundle: string;

beforeAll(async () => { bundle = await bundleForThePage(); }, 120_000);

function fixtureModulePlugin(): Plugin {
  const resolved = `\0${FIXTURE_ID}`;
  return {
    name: 'measured-width-fixture',
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

/** Renders the caption under `css` and returns how far its painted blocks reach along `axis`, in pixels. */
async function paintedLengthIn(browser: Browser, css: string, axis: 'x' | 'y'): Promise<number> {
  const page = await browser.newPage();
  try {
    await page.setContent('<!doctype html><html><head></head><body></body></html>');
    await page.addScriptTag({ content: bundle });
    return await page.evaluate(async ({ css, width, height, axis }) => {
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

      const words = ['w1', 'w2', 'w3'].map((id, i) => make('Word', {
        id, text: `w${i}`, time: make('TimeFragment', 0, 1),
      }));
      const doc = make('Document', {
        sections: [make('Section', {
          id: 'section', kind: 'main',
          segments: [make('Segment', { id: 's1', lines: [make('Line', { id: 'l1', words })] })],
        })],
      });
      const renderer = f.BrowserSubtitleFrameRenderer.create(
        { embed: (text: string) => Promise.resolve(text) }, make('GraphemeWordSplitter'),
      );
      await renderer.open(doc, {
        main: {
          css,
          inlineStyles: {},
          alignment: { verticalAlign: 'center', verticalOffset: 0.5, horizontalAlign: 'center', horizontalOffset: 0.5 },
          rendering: {
            splitWordsIntoLetters: false,
            videoFrame: { required: false, jpegQuality: 0.8 },
            padding: null,
            textDirection: 'ltr',
          },
          segmentOverrides: f.ElementRenderOverrides.fromEntries([]),
          subtreeOverrides: f.ElementRenderOverrides.fromEntries([]),
        },
      }, width, height);
      const [caption] = await renderer.getFrames([0.5]);
      const out = document.createElement('canvas');
      out.width = width;
      out.height = height;
      const context = out.getContext('2d')!;
      caption?.draw(context, 0, 0, width, height);
      renderer.close();
      const painted = context.getImageData(0, 0, width, height);

      let first = Infinity;
      let last = -Infinity;
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const i = (y * width + x) * 4;
          const green = painted.data[i + 1]! >= 200 && painted.data[i + 3]! >= 200;
          if (!green) continue;
          const position = axis === 'x' ? x : y;
          first = Math.min(first, position);
          last = Math.max(last, position);
        }
      }
      return last >= first ? last - first + 1 : 0;
    }, { css, width: WIDTH, height: HEIGHT, axis });
  } finally {
    await page.close();
  }
}

const ENGINES: ReadonlyArray<readonly [string, BrowserType]> = [['chromium', chromium], ['firefox', firefox]];

describe.each(ENGINES)('a width the stylesheet reads, in %s', (_name, engine) => {
  let browser: Browser;

  beforeAll(async () => { browser = await engine.launch(); }, 60_000);
  afterAll(async () => { await browser?.close(); });

  it.each(CASES)('is the laid-out one for $name', async ({ css, paintedLength, axis }) => {
    const length = await paintedLengthIn(browser, `${BASE_CSS}\n${css}`, axis);
    expect(Math.abs(length - paintedLength)).toBeLessThanOrEqual(2);
  }, 60_000);
});

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { resolve } from 'node:path';
import { chromium, firefox, type Browser, type BrowserType } from '@playwright/test';
import { build, type Plugin } from 'vite';

/**
 * A word's edges are read in the font the stylesheet gives the lifted word
 * of its caption, the caption's own classes included: a word whose letters
 * all end level is even, an ascender makes the top uneven, a descender the
 * bottom, and a rule that sets the lifted word in capitals evens its top.
 */

const FIXTURE_ID = 'virtual:word-edge-fixture';
const FIXTURE_SOURCE = `
  export { DomProbeWordEdgeReader } from '@modules/splitting/DomProbeWordEdgeReader';
  export { Segment } from '@modules/document/Segment';
  export { Line } from '@modules/document/Line';
  export { Word } from '@modules/document/Word';
  export { TimeFragment } from '@modules/document/TimeFragment';
  export { Tag } from '@modules/tags/Tag';
`;

const CSS = `
  .isolated-line .word { font-family: serif; font-style: italic; font-size: 60px; }
  .first-segment-in-document .isolated-line .word { text-transform: uppercase; }
`;

interface Edges {
  readonly topSpreadEm: number;
  readonly bottomSpreadEm: number;
}

let bundle: string;

beforeAll(async () => { bundle = await bundleForThePage(); }, 120_000);

function fixtureModulePlugin(): Plugin {
  const resolved = `\0${FIXTURE_ID}`;
  return {
    name: 'word-edge-fixture',
    resolveId: (id) => (id === FIXTURE_ID ? resolved : null),
    load: (id) => (id === resolved ? FIXTURE_SOURCE : null),
  };
}

async function bundleForThePage(): Promise<string> {
  const result = await build({
    configFile: false,
    logLevel: 'error',
    plugins: [fixtureModulePlugin()],
    resolve: { alias: { '@modules': resolve(import.meta.dirname, '..') } },
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

/** The edges of `text` read as the lifted word of a caption carrying `segmentClasses`. */
async function edgesOf(browser: Browser, text: string, segmentClasses: ReadonlyArray<string> = []): Promise<Edges | null> {
  const page = await browser.newPage();
  try {
    await page.setContent('<!doctype html><html><head></head><body></body></html>');
    await page.addScriptTag({ content: bundle });
    return await page.evaluate(({ text, segmentClasses, css }) => {
      type Ctor = new (...args: unknown[]) => unknown;
      const f = (window as unknown as { fixture: Record<string, Ctor> & { Tag: { of: (name: string) => unknown } } }).fixture;
      const make = <T,>(name: string, ...args: unknown[]): T => new (f[name] as unknown as new (...a: unknown[]) => T)(...args);
      const word = make<{ text: string }>('Word', { text, time: make('TimeFragment', 0, 1) });
      const segment = make('Segment', {
        lines: [make('Line', { words: [word] })],
        structureTags: new Set(segmentClasses.map((name) => f.Tag.of(name))),
      });
      const reader = make<{ edgesOf: (w: unknown, s: unknown) => Edges | null }>('DomProbeWordEdgeReader', {
        css, cssVars: {}, containerWidth: 720, containerHeight: 1280,
      });
      return reader.edgesOf(word, segment);
    }, { text, segmentClasses, css: CSS });
  } finally {
    await page.close();
  }
}

const EVEN = 0.1;
const UNEVEN = 0.15;

const ENGINES: ReadonlyArray<readonly [string, BrowserType]> = [['chromium', chromium], ['firefox', firefox]];

describe.each(ENGINES)('the edges of a lifted word, in %s', (_name, engine) => {
  let browser: Browser;

  beforeAll(async () => { browser = await engine.launch(); }, 60_000);
  afterAll(async () => { await browser?.close(); });

  it('are even where every letter ends level', async () => {
    const edges = await edgesOf(browser, 'ounces');
    expect(edges!.topSpreadEm).toBeLessThan(EVEN);
    expect(edges!.bottomSpreadEm).toBeLessThan(EVEN);
  }, 60_000);

  it('are uneven at the top with an ascender, and only there', async () => {
    const edges = await edgesOf(browser, 'bounces');
    expect(edges!.topSpreadEm).toBeGreaterThan(UNEVEN);
    expect(edges!.bottomSpreadEm).toBeLessThan(EVEN);
  }, 60_000);

  it('are uneven at the bottom with a descender, and only there', async () => {
    const edges = await edgesOf(browser, 'money');
    expect(edges!.topSpreadEm).toBeLessThan(EVEN);
    expect(edges!.bottomSpreadEm).toBeGreaterThan(UNEVEN);
  }, 60_000);

  it('are uneven at the top where a punctuation mark rises past short letters, and not where it sits low', async () => {
    const question = await edgesOf(browser, 'oneness?');
    const period = await edgesOf(browser, 'oneness.');
    expect(question!.topSpreadEm).toBeGreaterThan(UNEVEN);
    expect(period!.topSpreadEm).toBeLessThan(EVEN);
  }, 60_000);

  it('are read in the case the caption\'s own classes give the lifted word', async () => {
    const edges = await edgesOf(browser, 'bounces', ['first-segment-in-document']);
    expect(edges!.topSpreadEm).toBeLessThan(EVEN);
  }, 60_000);
});

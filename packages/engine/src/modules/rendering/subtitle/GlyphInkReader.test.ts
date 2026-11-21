import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { resolve } from 'node:path';
import { chromium, firefox, type Browser, type BrowserType } from '@playwright/test';
import { build, type Plugin } from 'vite';

/**
 * The ink a line publishes is its glyphs' reach from the baseline, read in
 * the font each text is drawn in and as a multiple of the line's own font
 * size: short letters reach less high than a capital or an ascender, a
 * descender reaches below, the case a style asks for is the case measured,
 * and the size the line is laid out at changes nothing.
 */

const FIXTURE_ID = 'virtual:glyph-ink-fixture';
const FIXTURE_SOURCE = `export { GlyphInkReader } from '@modules/rendering/subtitle/GlyphInkReader';`;

interface Ink {
  readonly ascentEm: number;
  readonly descentEm: number;
}

let bundle: string;

beforeAll(async () => { bundle = await bundleForThePage(); }, 120_000);

function fixtureModulePlugin(): Plugin {
  const resolved = `\0${FIXTURE_ID}`;
  return {
    name: 'glyph-ink-fixture',
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

/** The ink of a line holding `words`, each a span, laid out under `style`. */
async function inkOf(browser: Browser, words: ReadonlyArray<string>, style: string): Promise<Ink | null> {
  const page = await browser.newPage();
  try {
    await page.setContent('<!doctype html><html><head></head><body></body></html>');
    await page.addScriptTag({ content: bundle });
    return await page.evaluate(({ words, style }) => {
      const line = document.createElement('div');
      line.setAttribute('style', `font-family: sans-serif; ${style}`);
      for (const text of words) {
        const word = document.createElement('span');
        word.textContent = text;
        line.append(word, ' ');
      }
      document.body.appendChild(line);
      const fixture = (window as unknown as { fixture: { GlyphInkReader: new () => { extentsEm: (element: HTMLElement) => Ink | null } } }).fixture;
      return new fixture.GlyphInkReader().extentsEm(line);
    }, { words, style });
  } finally {
    await page.close();
  }
}

const ENGINES: ReadonlyArray<readonly [string, BrowserType]> = [['chromium', chromium], ['firefox', firefox]];

describe.each(ENGINES)('the ink a line reaches, in %s', (_name, engine) => {
  let browser: Browser;

  beforeAll(async () => { browser = await engine.launch(); }, 60_000);
  afterAll(async () => { await browser?.close(); });

  it('reaches higher with a capital or an ascender than with short letters alone', async () => {
    const short = await inkOf(browser, ['xxx', 'uno'], 'font-size: 40px;');
    const tall = await inkOf(browser, ['xxx', 'Uno'], 'font-size: 40px;');
    expect(tall!.ascentEm).toBeGreaterThan(short!.ascentEm + 0.1);
  }, 60_000);

  it('reaches below the baseline only with a descender', async () => {
    const flat = await inkOf(browser, ['xxx'], 'font-size: 40px;');
    const deep = await inkOf(browser, ['xxx', 'gyp'], 'font-size: 40px;');
    expect(flat!.descentEm).toBeLessThan(0.05);
    expect(deep!.descentEm).toBeGreaterThan(0.1);
  }, 60_000);

  it('measures the case the style draws', async () => {
    const plain = await inkOf(browser, ['xxx'], 'font-size: 40px;');
    const capitals = await inkOf(browser, ['xxx'], 'font-size: 40px; text-transform: uppercase;');
    expect(capitals!.ascentEm).toBeGreaterThan(plain!.ascentEm + 0.1);
  }, 60_000);

  it('answers the same multiple whatever size the line is laid out at', async () => {
    const small = await inkOf(browser, ['Hgx'], 'font-size: 20px;');
    const large = await inkOf(browser, ['Hgx'], 'font-size: 80px;');
    expect(Math.abs(small!.ascentEm - large!.ascentEm)).toBeLessThan(0.05);
    expect(Math.abs(small!.descentEm - large!.descentEm)).toBeLessThan(0.05);
  }, 60_000);

  it('reads the word drawn larger than its line against the line\'s own size', async () => {
    const even = await inkOf(browser, ['Hx'], 'font-size: 40px;');
    const page = await browser.newPage();
    try {
      await page.setContent('<!doctype html><html><head></head><body></body></html>');
      await page.addScriptTag({ content: bundle });
      const raised = await page.evaluate(() => {
        const line = document.createElement('div');
        line.setAttribute('style', 'font-family: sans-serif; font-size: 40px;');
        line.innerHTML = '<span>Hx</span> <span style="font-size: 80px">Hx</span>';
        document.body.appendChild(line);
        const fixture = (window as unknown as { fixture: { GlyphInkReader: new () => { extentsEm: (element: HTMLElement) => Ink | null } } }).fixture;
        return new fixture.GlyphInkReader().extentsEm(line);
      });
      expect(raised!.ascentEm).toBeCloseTo(even!.ascentEm * 2, 1);
    } finally {
      await page.close();
    }
  }, 60_000);
});

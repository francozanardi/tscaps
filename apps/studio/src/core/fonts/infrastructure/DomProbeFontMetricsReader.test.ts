import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { chromium, type Browser } from '@playwright/test';
import { build } from 'vite';
import { DomProbeFontMetricsReader } from '@core/fonts/infrastructure/DomProbeFontMetricsReader';

/**
 * That measuring a face asks the page for it at most once.
 *
 * Asking puts the document's fonts into `loading`, and a document whose
 * fonts are loading is re-derived when they settle — which measures
 * again. An ask that repeats is therefore a request loop with no end,
 * and the faces that drive it are exactly the ones that never arrive:
 * a file that 404s, a family the page describes but cannot fetch. The
 * loop is invisible to every test that only checks what is rendered,
 * so what is guarded here is the number of asks.
 */

class RecordingFontFaceSet {
  readonly asked: string[] = [];
  status = 'loading';
  check(): boolean {
    return false;
  }
  load(font: string): Promise<unknown[]> {
    this.asked.push(font);
    return Promise.resolve([]);
  }
}

let fonts: RecordingFontFaceSet;
let originalDocument: unknown;

beforeEach(() => {
  fonts = new RecordingFontFaceSet();
  originalDocument = (globalThis as { document?: unknown }).document;
  (globalThis as { document?: unknown }).document = { fonts };
});

afterEach(() => {
  (globalThis as { document?: unknown }).document = originalDocument;
});

describe('a face the page has not loaded', () => {
  it('is asked for once, however many times it is measured', () => {
    const reader = new DomProbeFontMetricsReader();
    for (let attempt = 0; attempt < 20; attempt++) reader.read('Anton');
    expect(fonts.asked).toHaveLength(1);
  });

  it('is asked for once per face, not once per measurement', () => {
    const reader = new DomProbeFontMetricsReader();
    for (let attempt = 0; attempt < 5; attempt++) {
      reader.read('Anton');
      reader.read('Lalezar');
    }
    expect(fonts.asked).toHaveLength(2);
  });

  it('reports no metrics rather than the ones of whatever stood in for it', () => {
    expect(new DomProbeFontMetricsReader().read('Anton')).toBeNull();
  });
});

/**
 * That a face is measured when the load it asked for arrives. Chrome and
 * Safari unload every face declared in CSS when any `@font-face` rules
 * change, so a face that arrived can read as unloaded by the time it is
 * measured again, and it is never asked for twice. The browser is the
 * oracle: whether a face is loaded, and what box it gives a line, is its
 * call.
 */
describe('a face that arrives and is then unloaded by a stylesheet change', () => {
  let browser: Browser;
  let bundle: string;
  const fontDataUrl = `data:font/woff2;base64,${readFileSync(
    resolve(import.meta.dirname, '../../../../node_modules/@fontsource/bebas-neue/files/bebas-neue-latin-400-normal.woff2'),
  ).toString('base64')}`;

  beforeAll(async () => {
    browser = await chromium.launch();
    const result = await build({
      configFile: false,
      logLevel: 'error',
      resolve: { alias: { '@core': resolve(import.meta.dirname, '../..') } },
      build: {
        write: false,
        minify: false,
        rollupOptions: {
          input: resolve(import.meta.dirname, 'DomProbeFontMetricsReader.ts'),
          preserveEntrySignatures: 'strict',
          output: { format: 'iife', name: 'fixture' },
        },
      },
    });
    const output = Array.isArray(result) ? result[0]!.output : 'output' in result ? result.output : [];
    bundle = (output as ReadonlyArray<{ type: string; code?: string }>)
      .filter((chunk) => chunk.type === 'chunk').map((chunk) => chunk.code ?? '').join('\n');
  });

  afterAll(async () => { await browser?.close(); });

  it('keeps the metrics it measured when the face arrived', async () => {
    const page = await browser.newPage();
    await page.setContent('<!doctype html><html><head></head><body></body></html>');
    await page.addScriptTag({ content: bundle });
    const outcome = await page.evaluate(async (font) => {
      type Reader = { read(family: string): { ascent: number; descent: number } | null };
      const { DomProbeFontMetricsReader: ReaderClass } = (globalThis as unknown as {
        fixture: { DomProbeFontMetricsReader: new () => Reader };
      }).fixture;
      const declare = (family: string): HTMLStyleElement => {
        const style = document.createElement('style');
        style.textContent = `@font-face { font-family: '${family}'; src: url(${font}) format('woff2'); }`;
        document.head.appendChild(style);
        return style;
      };
      declare('Probe');
      const reader = new ReaderClass();
      const beforeArrival = reader.read('Probe');
      await document.fonts.ready;
      const other = declare('Other');
      // Read the set between the two writes, so the browser takes them as
      // a stylesheet added and then rewritten rather than as one addition.
      document.fonts.check("100px 'Other'");
      other.textContent += '\n';
      const unloaded = !document.fonts.check("100px 'Probe'");
      const afterUnload = reader.read('Probe');

      const painted = document.createElement('div');
      painted.style.fontFamily = "'Probe'";
      painted.textContent = 'x';
      document.body.appendChild(painted);
      await document.fonts.load("100px 'Probe'");
      const expected = new ReaderClass().read('Probe');
      return { beforeArrival, unloaded, afterUnload, expected };
    }, fontDataUrl);
    await page.close();

    expect(outcome.beforeArrival).toBeNull();
    expect(outcome.unloaded).toBe(true);
    expect(outcome.expected).not.toBeNull();
    expect(outcome.afterUnload).toEqual(outcome.expected);
  });
});

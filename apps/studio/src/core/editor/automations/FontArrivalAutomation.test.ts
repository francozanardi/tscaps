import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { chromium, type Browser, type Page } from '@playwright/test';
import { build } from 'vite';

/**
 * That a face arriving re-derives the document, read off the face rather
 * than off the set's loading events, which Safari never fires for a face
 * declared in CSS. The browser is the oracle: whether a face loads, and
 * when, is its call.
 */

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
    build: {
      write: false,
      minify: false,
      rollupOptions: {
        input: resolve(import.meta.dirname, 'FontArrivalAutomation.ts'),
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

/**
 * A page whose automation is started and counts the derivations it asks
 * for. `asSafari` drops every listener for the set's loading events, as
 * Safari 26 behaves for a face declared in CSS.
 */
async function startedPage(options: { asSafari?: boolean } = {}): Promise<Page> {
  const page = await browser.newPage();
  await page.setContent('<!doctype html><html><head></head><body></body></html>');
  if (options.asSafari) {
    await page.evaluate(() => {
      const original = FontFaceSet.prototype.addEventListener;
      FontFaceSet.prototype.addEventListener = function (this: FontFaceSet, type: string, ...rest: unknown[]) {
        if (type.startsWith('loading')) return;
        (original as (...args: unknown[]) => void).call(this, type, ...rest);
      } as typeof original;
    });
  }
  await page.addScriptTag({ content: bundle });
  await page.evaluate(() => {
    const { FontArrivalAutomation } = (globalThis as unknown as {
      fixture: { FontArrivalAutomation: new (fonts: FontFaceSet, declarations: Node, refresh: { execute(): void }) => { start(): void; stop(): void } };
    }).fixture;
    const state = globalThis as unknown as { derivations: number; automation: { start(): void; stop(): void } };
    state.derivations = 0;
    state.automation = new FontArrivalAutomation(document.fonts, document.head, { execute: () => { state.derivations++; } });
    state.automation.start();
  });
  return page;
}

/** Declares `family` from `src` in a stylesheet of its own and paints text in it, which is what starts the load. */
async function declareAndPaint(page: Page, family: string, src: string): Promise<void> {
  await page.evaluate(([name, url]) => {
    const style = document.createElement('style');
    style.textContent = `@font-face { font-family: '${name}'; src: url(${url}) format('woff2'); }`;
    document.head.appendChild(style);
    const text = document.createElement('div');
    text.style.fontFamily = `'${name}', serif`;
    text.textContent = 'THIS IS HOW CAPTIONS SHOULD LOOK';
    document.body.appendChild(text);
  }, [family, src] as const);
}

async function derivationsOnceSettled(page: Page): Promise<number> {
  await page.evaluate(async () => {
    await document.fonts.ready;
    await new Promise((settled) => setTimeout(settled, 200));
  });
  return page.evaluate(() => (globalThis as unknown as { derivations: number }).derivations);
}

it('derives again once when a face declared after it started arrives', async () => {
  const page = await startedPage();
  await declareAndPaint(page, 'arriving', fontDataUrl);
  expect(await derivationsOnceSettled(page)).toBe(1);
  await page.close();
});

it('derives again when a face arrives in a browser that fires no loading events', async () => {
  const page = await startedPage({ asSafari: true });
  await declareAndPaint(page, 'arriving', fontDataUrl);
  expect(await derivationsOnceSettled(page)).toBe(1);
  await page.close();
});

it('derives again when a rewritten stylesheet brings the same face back', async () => {
  const page = await startedPage();
  await declareAndPaint(page, 'rewritten', fontDataUrl);
  await derivationsOnceSettled(page);
  await page.evaluate(() => {
    const style = document.head.querySelector('style')!;
    style.textContent = `${style.textContent}\n`;
  });
  expect(await derivationsOnceSettled(page)).toBe(2);
  await page.close();
});

it('derives nothing for a face that fails to load', async () => {
  const page = await startedPage();
  await declareAndPaint(page, 'missing', 'data:font/woff2;base64,AAAA');
  expect(await derivationsOnceSettled(page)).toBe(0);
  await page.close();
});

it('derives nothing once stopped', async () => {
  const page = await startedPage();
  await page.evaluate(() => (globalThis as unknown as { automation: { stop(): void } }).automation.stop());
  await declareAndPaint(page, 'late', fontDataUrl);
  expect(await derivationsOnceSettled(page)).toBe(0);
  await page.close();
});

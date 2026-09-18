import { resolve } from 'node:path';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { chromium, type Browser } from '@playwright/test';
import { build } from 'vite';

let browser: Browser;
let bundle: string;

beforeAll(async () => {
  browser = await chromium.launch();
  const result = await build({
    configFile: false,
    logLevel: 'error',
    build: {
      write: false,
      minify: false,
      rollupOptions: {
        input: resolve(import.meta.dirname, 'BrowserStyleSheetFontFaceReader.ts'),
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

it('never feeds generated faces back into the next compilation', async () => {
  const page = await browser.newPage();
  await page.setContent(`<style>@font-face { font-family: 'Original'; src: local('Arial'); }</style>`);
  await page.addScriptTag({ content: bundle });
  const counts = await page.evaluate(() => {
    const { BrowserStyleSheetFontFaceReader } = (globalThis as unknown as {
      fixture: { BrowserStyleSheetFontFaceReader: new () => { read(names: Set<string>): unknown[] } };
    }).fixture;
    const reader = new BrowserStyleSheetFontFaceReader();
    const generated = document.createElement('style');
    generated.setAttribute('data-tscaps-compiled-fonts', '');
    document.head.appendChild(generated);
    const counts: number[] = [];
    for (let iteration = 0; iteration < 10; iteration++) {
      const faces = reader.read(new Set(['Original']));
      counts.push(faces.length);
      generated.textContent = faces.map(() => `@font-face { font-family:'Original'; src:local('Arial'); }`).join('\n');
    }
    return counts;
  });
  expect(counts).toEqual(Array(10).fill(1));
  await page.close();
});

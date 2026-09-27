import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { bootEditor, setDocumentJson } from './support/editorBoot';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURES = path.resolve(__dirname, 'fixtures');

test('export from synthetic video and document', async ({ page }) => {
  await bootEditor(page);

  const videoBuf = await readFile(path.join(FIXTURES, 'sample.mp4'));
  const documentJson = JSON.parse(await readFile(path.join(FIXTURES, 'document.json'), 'utf8'));

  await page.evaluate(async (bytes: number[]) => {
    const blob = new Blob([new Uint8Array(bytes)], { type: 'video/mp4' });
    await window.__tscapsE2E!.setVideo(blob);
  }, Array.from(videoBuf));

  await setDocumentJson(page, documentJson);

  await page.evaluate(() => { void window.__tscapsE2E!.triggerExport(); });

  await page.waitForFunction(
    () => window.__tscapsE2E?.lastResult !== undefined,
    null,
    { timeout: 90_000 },
  );

  const result = await page.evaluate(async () => {
    const r = window.__tscapsE2E!.lastResult!;
    if ('error' in r) return r;
    const arrayBuffer = await r.blob.arrayBuffer();
    return {
      sizeBytes: r.sizeBytes,
      mimeType: r.mimeType,
      headerBytes: Array.from(new Uint8Array(arrayBuffer.slice(0, 16))),
    };
  });

  if ('error' in result) {
    throw new Error(`Export failed: ${result.error}`);
  }

  expect(result.sizeBytes).toBeGreaterThan(1024);
  expect(result.mimeType).toMatch(/mp4|webm/);

  const ftypBox = String.fromCharCode(...result.headerBytes.slice(4, 8));
  expect(ftypBox).toBe('ftyp');
});

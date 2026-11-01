import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { resolve } from 'node:path';
import { chromium, firefox, type Browser, type BrowserType } from '@playwright/test';
import { build } from 'vite';

/**
 * That a sprite sheet the probe accepts paints a caption at its far
 * edge the way it paints one at its origin, asked of both engines the
 * export runs in.
 *
 * The caption is not the probe's own marker: a blurred text shadow over
 * a blurred plate, the shape a frosted-glass caption takes. Firefox
 * paints that shadow as a solid box once it lies far enough into the
 * SVG, so a probe that only checks the corner is painted accepts sheets
 * that export every later frame wrong.
 */

const HEIGHT = 1280;
const SHEET_WIDTHS = [720, 7200, 8640, 15120];
const CAPTION_WIDTH = 220;
const CAPTION_HEIGHT = 70;

let bundle: string;

beforeAll(async () => {
  const result = await build({
    configFile: false,
    logLevel: 'error',
    resolve: { alias: { '@modules': resolve(import.meta.dirname, '../..') } },
    build: {
      write: false,
      minify: false,
      rollupOptions: {
        input: resolve(import.meta.dirname, 'ImageDecodeSpriteSheetRasterProbe.ts'),
        preserveEntrySignatures: 'strict',
        output: { format: 'iife', name: 'fixture' },
      },
    },
  });
  const output = Array.isArray(result) ? result[0]!.output : 'output' in result ? result.output : [];
  bundle = (output as ReadonlyArray<{ type: string; code?: string }>)
    .filter((chunk) => chunk.type === 'chunk').map((chunk) => chunk.code ?? '').join('\n');
}, 120_000);

interface SheetReading {
  readonly width: number;
  readonly accepted: boolean;
  /** Pixels of the far caption whose colour differs from the same caption drawn at the origin. */
  readonly differingPixels: number;
}

async function readSheets(browser: Browser): Promise<SheetReading[]> {
  const page = await browser.newPage();
  try {
    await page.setContent('<!doctype html><html><body></body></html>');
    await page.addScriptTag({ content: bundle });
    return await page.evaluate(async ({ widths, height, captionWidth, captionHeight }) => {
      const { ImageDecodeSpriteSheetRasterProbe } = (globalThis as unknown as {
        fixture: { ImageDecodeSpriteSheetRasterProbe: new () => { offer(w: number, h: number): Promise<{ refusal: string | null }> } };
      }).fixture;
      const probe = new ImageDecodeSpriteSheetRasterProbe();
      const caption = (x: number, y: number): string =>
        `<foreignObject x="${x}" y="${y}" width="${captionWidth}" height="${captionHeight}">`
        + `<div xmlns="http://www.w3.org/1999/xhtml" style="position:relative;isolation:isolate;overflow:hidden;border-radius:30px;width:${captionWidth}px;height:${captionHeight}px;font:600 30px sans-serif;color:#fff;padding:14px 20px;box-sizing:border-box;">`
        + `<div style="position:absolute;inset:0;z-index:-1;filter:blur(6px);background:#3a6186;"></div>`
        + `<span style="text-shadow:0 0 0.22em rgba(0,0,0,0.55),0 0.04em 0.08em rgba(0,0,0,0.55);">right?</span>`
        + `</div></foreignObject>`;
      const readings = [];
      for (const width of widths) {
        const outcome = await probe.offer(width, height);
        const farX = width - captionWidth;
        const farY = height - captionHeight;
        const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">`
          + `<rect width="100%" height="100%" fill="#89253e"/>` + caption(0, 0) + caption(farX, farY) + `</svg>`;
        const image = new Image();
        image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
        await image.decode();
        const context = new OffscreenCanvas(width, height).getContext('2d')!;
        context.drawImage(image, 0, 0);
        const near = context.getImageData(0, 0, captionWidth, captionHeight).data;
        const far = context.getImageData(farX, farY, captionWidth, captionHeight).data;
        let differingPixels = 0;
        for (let i = 0; i < near.length; i += 4) {
          const delta = Math.max(Math.abs(near[i]! - far[i]!), Math.abs(near[i + 1]! - far[i + 1]!), Math.abs(near[i + 2]! - far[i + 2]!));
          if (delta > 48) differingPixels++;
        }
        readings.push({ width, accepted: outcome.refusal === null, differingPixels });
      }
      return readings;
    }, { widths: SHEET_WIDTHS, height: HEIGHT, captionWidth: CAPTION_WIDTH, captionHeight: CAPTION_HEIGHT });
  } finally {
    await page.close();
  }
}

describe.each<[string, BrowserType]>([['chromium', chromium], ['firefox', firefox]])('in %s', (_, engine) => {
  let browser: Browser;

  beforeAll(async () => { browser = await engine.launch(); }, 60_000);
  afterAll(async () => { await browser.close(); });

  it('accepts only sheets whose far edge paints a caption as the origin does', async () => {
    const readings = await readSheets(browser);
    for (const reading of readings.filter((candidate) => candidate.accepted)) {
      expect(reading).toMatchObject({ differingPixels: 0 });
    }
    expect(readings.filter((reading) => reading.accepted).map((reading) => reading.width)).toEqual(
      expect.arrayContaining([720, 7200]),
    );
  }, 60_000);
});

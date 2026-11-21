import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { resolve } from 'node:path';
import { chromium, type Browser } from '@playwright/test';
import { build, type Plugin } from 'vite';

/**
 * That a GIF plays its own frames at their own pace, asked of the
 * browser's decoder, as many times as it says it runs; that its frames
 * are held within the cap it is opened with; and that a browser without
 * that decoder is refused by name rather than shown a still.
 */

const FIXTURE_ID = 'virtual:gif-opener-fixture';
const FIXTURE_SOURCE = `
  export { ImageDecoderGifOpener } from '@modules/video/animation/ImageDecoderGifOpener';
  export { GifFrameDurationReader } from '@modules/video/animation/GifFrameDurationReader';
  export { GifFileReader } from '@modules/video/animation/GifFileReader';
`;

const RED = [255, 0, 0];
const BLUE = [0, 0, 255];

let browser: Browser;
let bundle: string;

beforeAll(async () => {
  browser = await chromium.launch();
  bundle = await bundleForThePage();
}, 180_000);

afterAll(async () => { await browser.close(); });

describe('opening a GIF', () => {
  it('shows each frame for the delay it states, and starts over once it runs out', async () => {
    const colours = await coloursAt([0, 0.09, 0.1, 0.39, 0.4, 0.45], { loops: 0 });

    expect(colours).toEqual([RED, RED, BLUE, BLUE, RED, RED]);
  });

  it('holds its last frame once it has run as many times as its loop count says', async () => {
    const once = await coloursAt([0.1, 0.4, 2], {});
    const twice = await coloursAt([0.4, 0.5, 0.8, 2], { loops: 1 });

    expect(once).toEqual([BLUE, BLUE, BLUE]);
    expect(twice).toEqual([RED, BLUE, BLUE, BLUE]);
  });

  it('holds its frames within the cap it is opened with, keeping their shape, and a smaller GIF whole', async () => {
    const gif = [...solidGif(8, 4)];

    expect(await sizeInPage(gif, 4)).toEqual({ width: 4, height: 2 });
    expect(await sizeInPage(gif, 100)).toEqual({ width: 8, height: 4 });
  });

  it('refuses by name where the browser has no ImageDecoder, rather than showing a still', async () => {
    const page = await browser.newPage();
    try {
      await page.route('**/*', (route) => route.fulfill({ contentType: 'text/html', body: '<title>gif opener</title>' }));
      await page.goto('http://localhost/gif-opener');
      await page.addScriptTag({ content: bundle });
      const refusal = await page.evaluate(async (gif) => {
        const fixture = (window as unknown as { fixture: Record<string, never> }).fixture as unknown as {
          ImageDecoderGifOpener: new (reader: unknown) => { open: (blob: Blob) => Promise<unknown> };
          GifFrameDurationReader: new (files: unknown) => unknown;
          GifFileReader: new () => unknown;
        };
        delete (window as unknown as { ImageDecoder?: unknown }).ImageDecoder;
        const opener = new fixture.ImageDecoderGifOpener(new fixture.GifFrameDurationReader(new fixture.GifFileReader()));
        return opener.open(new Blob([new Uint8Array(gif)], { type: 'image/gif' })).then(() => null, (error: Error) => error.name);
      }, [...twoFrameGif(0)]);

      expect(refusal).toBe('AnimatedImageOpenFailedError');
    } finally {
      await page.close();
    }
  });
});

async function coloursAt(
  moments: number[],
  { loops }: { loops?: number },
): Promise<number[][]> {
  const page = await browser.newPage();
  try {
    // WebCodecs needs a secure context, which `about:blank` is not.
    await page.route('**/*', (route) => route.fulfill({ contentType: 'text/html', body: '<title>gif opener</title>' }));
    await page.goto('http://localhost/gif-opener');
    await page.addScriptTag({ content: bundle });
    return await page.evaluate(readColoursInPage, { moments, gif: [...twoFrameGif(loops)] });
  } finally {
    await page.close();
  }
}

/**
 * A 1×1 GIF: red for a tenth of a second, then blue for three tenths;
 * `loops` is its NETSCAPE2.0 loop count, none written when omitted.
 */
function twoFrameGif(loops?: number): Uint8Array {
  const frame = (delay: number, lzwPixel: number) => [
    0x21, 0xf9, 4, 0, delay, 0, 0, 0,
    0x2c, 0, 0, 0, 0, 1, 0, 1, 0, 0,
    2, 2, lzwPixel, 0x01, 0,
  ];
  return new Uint8Array([
    ...[...'GIF89a'].map((char) => char.charCodeAt(0)),
    1, 0, 1, 0, 0x80, 0, 0,
    0xff, 0, 0, 0, 0, 0xff,
    ...(loops === undefined ? [] : [0x21, 0xff, 11, ...[...'NETSCAPE2.0'].map((char) => char.charCodeAt(0)), 3, 1, loops, 0, 0]),
    // The LZW codes for one pixel of the first colour, then of the second.
    ...frame(10, 0x44),
    ...frame(30, 0x4c),
    0x3b,
  ]);
}

/**
 * A `width` × `height` GIF of two red frames, looping. Its pixels are
 * written as a clear code before each one, which keeps every LZW code
 * three bits wide, so no compressor is needed.
 */
function solidGif(width: number, height: number): Uint8Array {
  const codes: number[] = [];
  for (let pixel = 0; pixel < width * height; pixel++) codes.push(4, 0);
  codes.push(5);
  const data: number[] = [];
  let buffer = 0;
  let bits = 0;
  for (const code of codes) {
    buffer |= code << bits;
    bits += 3;
    while (bits >= 8) {
      data.push(buffer & 0xff);
      buffer >>= 8;
      bits -= 8;
    }
  }
  if (bits > 0) data.push(buffer & 0xff);
  const subBlocks: number[] = [];
  for (let at = 0; at < data.length; at += 255) {
    const chunk = data.slice(at, at + 255);
    subBlocks.push(chunk.length, ...chunk);
  }
  const frame = [
    0x21, 0xf9, 4, 0, 10, 0, 0, 0,
    0x2c, 0, 0, 0, 0, width & 0xff, width >> 8, height & 0xff, height >> 8, 0,
    2, ...subBlocks, 0,
  ];
  return new Uint8Array([
    ...[...'GIF89a'].map((char) => char.charCodeAt(0)),
    width & 0xff, width >> 8, height & 0xff, height >> 8, 0x80, 0, 0,
    0xff, 0, 0, 0, 0, 0xff,
    0x21, 0xff, 11, ...[...'NETSCAPE2.0'].map((char) => char.charCodeAt(0)), 3, 1, 0, 0, 0,
    ...frame,
    ...frame,
    0x3b,
  ]);
}

/** The size the opened footage holds its frames at, opened with `maxLongestSidePx`. */
async function sizeInPage(gif: number[], maxLongestSidePx: number): Promise<{ width: number; height: number }> {
  const page = await browser.newPage();
  try {
    await page.route('**/*', (route) => route.fulfill({ contentType: 'text/html', body: '<title>gif opener</title>' }));
    await page.goto('http://localhost/gif-opener');
    await page.addScriptTag({ content: bundle });
    return await page.evaluate(async (request) => {
      const fixture = (window as unknown as { fixture: Record<string, never> }).fixture as unknown as {
        ImageDecoderGifOpener: new (reader: unknown, cap: number) => {
          open: (blob: Blob) => Promise<{ width: number; height: number; close: () => Promise<void> }>;
        };
        GifFrameDurationReader: new (files: unknown) => unknown;
        GifFileReader: new () => unknown;
      };
      const opener = new fixture.ImageDecoderGifOpener(new fixture.GifFrameDurationReader(new fixture.GifFileReader()), request.maxLongestSidePx);
      const footage = await opener.open(new Blob([new Uint8Array(request.gif)], { type: 'image/gif' }));
      const size = { width: footage.width, height: footage.height };
      await footage.close();
      return size;
    }, { gif, maxLongestSidePx });
  } finally {
    await page.close();
  }
}

interface PageRequest {
  moments: number[];
  gif: number[];
}

async function readColoursInPage(request: PageRequest): Promise<number[][]> {
  const fixture = (window as unknown as { fixture: Record<string, never> }).fixture as unknown as {
    ImageDecoderGifOpener: new (reader: unknown) => {
      open: (blob: Blob) => Promise<{
        pictureAt: (sec: number) => Promise<{
          draw: (context: OffscreenCanvasRenderingContext2D, x: number, y: number, w: number, h: number) => void;
        } | null>;
        close: () => Promise<void>;
      }>;
    };
    GifFrameDurationReader: new (files: unknown) => unknown;
        GifFileReader: new () => unknown;
  };
  const opener = new fixture.ImageDecoderGifOpener(new fixture.GifFrameDurationReader(new fixture.GifFileReader()));
  const footage = await opener.open(new Blob([new Uint8Array(request.gif)], { type: 'image/gif' }));
  const canvas = new OffscreenCanvas(1, 1);
  const context = canvas.getContext('2d', { willReadFrequently: true })!;
  const colours: number[][] = [];
  for (const moment of request.moments) {
    const picture = await footage.pictureAt(moment);
    context.clearRect(0, 0, 1, 1);
    picture?.draw(context, 0, 0, 1, 1);
    colours.push([...context.getImageData(0, 0, 1, 1).data.slice(0, 3)]);
  }
  await footage.close();
  return colours;
}

function fixtureModulePlugin(): Plugin {
  const resolved = `\0${FIXTURE_ID}`;
  return {
    name: 'gif-opener-fixture',
    resolveId: (id) => (id === FIXTURE_ID ? resolved : null),
    load: (id) => (id === resolved ? FIXTURE_SOURCE : null),
  };
}

async function bundleForThePage(): Promise<string> {
  const result = await build({
    configFile: false,
    logLevel: 'error',
    plugins: [fixtureModulePlugin()],
    resolve: { alias: { '@modules': resolve(import.meta.dirname, '..', '..') } },
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

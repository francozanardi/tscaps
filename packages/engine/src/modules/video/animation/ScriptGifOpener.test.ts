import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { resolve } from 'node:path';
import { chromium, firefox, type Browser, type BrowserType } from '@playwright/test';
import { build, type Plugin } from 'vite';
import { GifFixtureWriter, type FixtureColour, type FixtureGif } from '@modules/video/animation/GifFixtureWriter.fixture';

/**
 * A GIF plays in a browser with no `ImageDecoder` exactly as it plays
 * through one: the script decoder answers the same pixels, frame for
 * frame, as Chromium's own decoder; the preferred way of opening falls
 * to it where `ImageDecoder` is missing, and the GIF animates; and a
 * file neither can read is refused by name. Firefox, which has an
 * `ImageDecoder` of its own, is asked the same.
 */

const FIXTURE_ID = 'virtual:script-gif-opener-fixture';
const FIXTURE_SOURCE = `
  export { ImageDecoderGifOpener } from '@modules/video/animation/ImageDecoderGifOpener';
  export { ScriptGifOpener } from '@modules/video/animation/ScriptGifOpener';
  export { FallbackAnimatedImageOpener } from '@modules/video/animation/FallbackAnimatedImageOpener';
  export { GifFileReader } from '@modules/video/animation/GifFileReader';
  export { GifFrameDurationReader } from '@modules/video/animation/GifFrameDurationReader';
  export { GifLzwDecoder } from '@modules/video/animation/GifLzwDecoder';
`;

const RED: FixtureColour = [255, 0, 0];
const GREEN: FixtureColour = [0, 255, 0];
const BLUE: FixtureColour = [0, 0, 255];
const WHITE: FixtureColour = [255, 255, 255];
const PALETTE = [RED, GREEN, BLUE, WHITE];

const writer = new GifFixtureWriter();

/** `browser` is no opener: each frame decoded once, in order, by the browser's own `ImageDecoder`. */
type Way = 'script' | 'preferred' | 'browser';

interface PageRequest {
  gif: number[];
  moments: number[];
  way: Way;
  hideImageDecoder: boolean;
  maxLongestSidePx: number | null;
}

interface PageAnswer {
  /** The name of the error opening rejected with; null when it opened. */
  refusal: string | null;
  width: number;
  height: number;
  /** For each moment, the footage drawn at its own size, as RGBA. */
  frames: number[][];
}

let bundle: string;

beforeAll(async () => {
  bundle = await bundleForThePage();
}, 180_000);

function fill(count: number, index: number): number[] {
  return new Array<number>(count).fill(index);
}

/** A pseudo-random index sequence, the same on every run. */
function noise(count: number, colours: number, seed: number): number[] {
  let state = seed;
  return Array.from({ length: count }, () => {
    state = (state * 1103515245 + 12345) & 0x7fffffff;
    return (state >> 8) % colours;
  });
}

/** A moment just inside each frame of `gif`, in order. */
function frameMoments(gif: FixtureGif): number[] {
  let startSec = 0;
  return gif.frames.map((frame) => {
    const moment = startSec + 0.005;
    startSec += (frame.delay ?? 10) / 100;
    return moment;
  });
}

const WIDE_PALETTE: FixtureColour[] = Array.from({ length: 256 }, (_, index) => [index, 255 - index, (index * 7) & 0xff]);

/** GIFs that between them hold each thing a decoder has to get right. */
const CASES: ReadonlyArray<readonly [string, FixtureGif]> = [
  ['every disposal method, over and under transparency', {
    width: 12,
    height: 10,
    globalPalette: PALETTE,
    frames: [
      { width: 12, height: 10, indices: noise(120, 4, 1), delay: 5 },
      { left: 2, top: 1, width: 5, height: 4, indices: noise(20, 4, 2), disposal: 3, transparentIndex: 3 },
      { left: 4, top: 3, width: 6, height: 6, indices: noise(36, 4, 3), disposal: 2 },
      { left: 0, top: 5, width: 12, height: 5, indices: noise(60, 4, 4), disposal: 1, transparentIndex: 0 },
      { left: 6, top: 0, width: 6, height: 10, indices: noise(60, 4, 5), disposal: 3, delay: 7 },
      { width: 12, height: 10, indices: fill(120, 2), disposal: 2 },
      { left: 1, top: 1, width: 3, height: 3, indices: noise(9, 4, 6), transparentIndex: 1 },
    ],
  }],
  ['interlaced frames of every height the passes treat apart', {
    width: 5,
    height: 19,
    globalPalette: PALETTE,
    frames: [
      { width: 5, height: 19, indices: noise(95, 4, 7), interlaced: true },
      { left: 1, top: 2, width: 3, height: 7, indices: noise(21, 4, 8), interlaced: true, transparentIndex: 2 },
      { left: 0, top: 0, width: 2, height: 3, indices: noise(6, 4, 9), interlaced: true },
    ],
  }],
  ['colour tables of a frame\'s own', {
    width: 6,
    height: 4,
    globalPalette: PALETTE,
    frames: [
      { width: 6, height: 4, indices: noise(24, 4, 10) },
      { width: 6, height: 4, indices: noise(24, 8, 11), localPalette: WIDE_PALETTE.slice(40, 48) },
      { left: 2, top: 1, width: 3, height: 2, indices: noise(6, 2, 12), localPalette: [WHITE, GREEN] },
    ],
  }],
  ['codes growing to twelve bits, clear codes, and a full table kept', {
    width: 64,
    height: 48,
    globalPalette: WIDE_PALETTE,
    frames: [
      { width: 64, height: 48, indices: noise(3072, 256, 13) },
      { width: 64, height: 48, indices: noise(3072, 256, 14), fullTable: 'keep' },
      { width: 64, height: 48, indices: noise(3072, 13, 15), minCodeSize: 4, clearEvery: 11 },
      { width: 64, height: 48, indices: [...fill(2000, 7), ...noise(1072, 3, 16)], minCodeSize: 3 },
    ],
  }],
];

/** Red, green, then blue for a tenth of a second each, looping for ever. */
const TRAFFIC_LIGHT: FixtureGif = {
  width: 2,
  height: 2,
  globalPalette: PALETTE,
  loops: 0,
  frames: [
    { width: 2, height: 2, indices: fill(4, 0) },
    { width: 2, height: 2, indices: fill(4, 1) },
    { width: 2, height: 2, indices: fill(4, 2) },
  ],
};

describe.each<[string, BrowserType]>([['chromium', chromium], ['firefox', firefox]])('in %s', (_, engine) => {
  let browser: Browser;

  beforeAll(async () => { browser = await engine.launch(); }, 60_000);
  afterAll(async () => { await browser?.close(); });

  async function readGif(gif: FixtureGif | Uint8Array, request: Omit<PageRequest, 'gif'>): Promise<PageAnswer> {
    const page = await browser.newPage();
    try {
      // WebCodecs needs a secure context, which `about:blank` is not.
      await page.route('**/*', (route) => route.fulfill({ contentType: 'text/html', body: '<title>script gif opener</title>' }));
      await page.goto('http://localhost/script-gif-opener');
      await page.addScriptTag({ content: bundle });
      const bytes = gif instanceof Uint8Array ? gif : writer.write(gif);
      return await page.evaluate(readInPage, { ...request, gif: [...bytes] });
    } finally {
      await page.close();
    }
  }

  it('animates a GIF where the browser has no ImageDecoder, starting over as it loops', async () => {
    const answer = await readGif(TRAFFIC_LIGHT, {
      moments: [0.05, 0.15, 0.25, 0.35, 0.15],
      way: 'preferred',
      hideImageDecoder: true,
      maxLongestSidePx: null,
    });

    expect(answer.refusal).toBeNull();
    expect(answer.frames.map((frame) => frame.slice(0, 4))).toEqual([
      [...RED, 255], [...GREEN, 255], [...BLUE, 255], [...RED, 255], [...GREEN, 255],
    ]);
  });

  it('animates a GIF the way the browser prefers to open it', async () => {
    const answer = await readGif(TRAFFIC_LIGHT, {
      moments: [0.05, 0.15, 0.25, 0.35],
      way: 'preferred',
      hideImageDecoder: false,
      maxLongestSidePx: null,
    });

    expect(answer.refusal).toBeNull();
    expect(answer.frames.map((frame) => frame.slice(0, 4))).toEqual([[...RED, 255], [...GREEN, 255], [...BLUE, 255], [...RED, 255]]);
  });

  it('holds frames decoded in script within the cap it is opened with, keeping their shape', async () => {
    const wide: FixtureGif = { width: 8, height: 4, globalPalette: PALETTE, frames: [{ width: 8, height: 4, indices: fill(32, 0) }] };

    const capped = await readGif(wide, { moments: [0], way: 'script', hideImageDecoder: true, maxLongestSidePx: 4 });
    const whole = await readGif(wide, { moments: [0], way: 'script', hideImageDecoder: true, maxLongestSidePx: 100 });

    expect([capped.width, capped.height]).toEqual([4, 2]);
    expect([whole.width, whole.height]).toEqual([8, 4]);
  });

  it('refuses by name a GIF neither way can read, rather than showing a still', async () => {
    const noFrame = writer.write({ width: 2, height: 1, globalPalette: PALETTE, frames: [] });
    const notAGif = new TextEncoder().encode('\x89PNG\r\n\x1a\n0000000000000000');

    for (const bytes of [noFrame, notAGif]) {
      const answer = await readGif(bytes, { moments: [0], way: 'preferred', hideImageDecoder: false, maxLongestSidePx: null });

      expect(answer.refusal).toBe('AnimatedImageOpenFailedError');
    }
  });

  it.each(CASES)('decodes %s in script to the pixels the browser\'s own decoder gives', async (_, gif) => {
    const moments = frameMoments(gif);
    const ownDecoder = await readGif(gif, { moments, way: 'browser', hideImageDecoder: false, maxLongestSidePx: null });
    const script = await readGif(gif, { moments, way: 'script', hideImageDecoder: true, maxLongestSidePx: null });

    expect(ownDecoder.frames.length).toBe(gif.frames.length);
    expect(script.refusal).toBeNull();
    script.frames.forEach((frame, index) => expect(frame, `frame ${index}`).toEqual(ownDecoder.frames[index]));
  });
});

async function readInPage(request: PageRequest): Promise<PageAnswer> {
  interface Picture {
    draw: (context: OffscreenCanvasRenderingContext2D, x: number, y: number, w: number, h: number) => void;
  }
  interface Footage {
    width: number;
    height: number;
    pictureAt: (sec: number) => Promise<Picture | null>;
    close: () => Promise<void>;
  }
  interface Opener {
    open: (blob: Blob) => Promise<Footage>;
  }
  const fixture = (window as unknown as { fixture: Record<string, never> }).fixture as unknown as {
    ImageDecoderGifOpener: new (durations: unknown, cap?: number) => Opener;
    ScriptGifOpener: new (files: unknown, durations: unknown, lzw: unknown, cap?: number) => Opener;
    FallbackAnimatedImageOpener: new (openers: Opener[]) => Opener;
    GifFileReader: new () => unknown;
    GifFrameDurationReader: new (files: unknown) => unknown;
    GifLzwDecoder: new () => unknown;
  };
  if (request.way === 'browser') return decodeEachFrameOnce(request.gif);
  if (request.hideImageDecoder) delete (window as unknown as { ImageDecoder?: unknown }).ImageDecoder;
  const cap = request.maxLongestSidePx ?? Infinity;
  const files = new fixture.GifFileReader();
  const durations = new fixture.GifFrameDurationReader(files);
  const native = new fixture.ImageDecoderGifOpener(durations, cap);
  const script = new fixture.ScriptGifOpener(files, durations, new fixture.GifLzwDecoder(), cap);
  const opener = request.way === 'script' ? script : new fixture.FallbackAnimatedImageOpener([native, script]);
  let footage: Footage;
  try {
    footage = await opener.open(new Blob([new Uint8Array(request.gif)], { type: 'image/gif' }));
  } catch (error) {
    return { refusal: (error as Error).name, width: 0, height: 0, frames: [] };
  }
  const canvas = new OffscreenCanvas(footage.width, footage.height);
  const context = canvas.getContext('2d', { willReadFrequently: true })!;
  const frames: number[][] = [];
  for (const moment of request.moments) {
    const picture = await footage.pictureAt(moment);
    context.clearRect(0, 0, footage.width, footage.height);
    picture?.draw(context, 0, 0, footage.width, footage.height);
    frames.push([...context.getImageData(0, 0, footage.width, footage.height).data]);
  }
  const answer = { refusal: null, width: footage.width, height: footage.height, frames };
  await footage.close();
  return answer;

  async function decodeEachFrameOnce(gif: number[]): Promise<PageAnswer> {
    const decoder = new ImageDecoder({ data: new Uint8Array(gif), type: 'image/gif' });
    await decoder.tracks.ready;
    await decoder.completed;
    const decoded: number[][] = [];
    let width = 0;
    let height = 0;
    for (let frameIndex = 0; frameIndex < (decoder.tracks.selectedTrack?.frameCount ?? 0); frameIndex++) {
      const { image } = await decoder.decode({ frameIndex });
      width = image.displayWidth;
      height = image.displayHeight;
      const context = new OffscreenCanvas(width, height).getContext('2d', { willReadFrequently: true })!;
      context.drawImage(image, 0, 0, width, height);
      image.close();
      decoded.push([...context.getImageData(0, 0, width, height).data]);
    }
    decoder.close();
    return { refusal: null, width, height, frames: decoded };
  }
}

function fixtureModulePlugin(): Plugin {
  const resolved = `\0${FIXTURE_ID}`;
  return {
    name: 'script-gif-opener-fixture',
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

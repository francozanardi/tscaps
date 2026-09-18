import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { resolve } from 'node:path';
import { chromium, type Browser } from '@playwright/test';
import { build, type Plugin } from 'vite';

/**
 * That reading a source in spans yields the same frames as reading it
 * whole, asked of the decoder that will do it.
 *
 * A seek resumes at the key frame before the span, so the decoder meets
 * frames it must withhold. One frame either way still writes a valid
 * file: a frame of the cut spliced in, or a frame of the take gone.
 */

const FIXTURE_ID = 'virtual:seeked-spans-fixture';
const FIXTURE_SOURCE = `
  export { WebCodecsVideoFrameDecoder } from '@modules/video/mediabunny/frame/WebCodecsVideoFrameDecoder';
  export {
    ALL_FORMATS, BlobSource, BufferTarget, CanvasSource, Input, Mp4OutputFormat, Output,
  } from 'mediabunny';
`;

const FPS = 30;
const FRAME_COUNT = 180;
const SIZE = { width: 320, height: 240 };
/** Short enough that every span below has a key frame to land on. */
const KEY_FRAME_INTERVAL_SEC = 1;

let browser: Browser;
let bundle: string;

beforeAll(async () => {
  browser = await chromium.launch();
  bundle = await bundleForThePage();
}, 180_000);

afterAll(async () => { await browser.close(); });

describe('reading a source in spans', () => {
  it('yields the frames of one span and no others', async () => {
    const read = await framesRead([{ startSec: 2, endSec: 4 }]);
    expect(read.spanned).toEqual(read.whole.filter((ms) => ms >= 2000 && ms < 4000));
    expect(read.spanned.length).toBeGreaterThan(0);
  });

  it('yields the same frames as reading it whole and dropping the cut', async () => {
    const read = await framesRead([
      { startSec: 0, endSec: 1 },
      { startSec: 5, endSec: Number.POSITIVE_INFINITY },
    ]);
    expect(read.spanned).toEqual(read.whole.filter((ms) => ms < 1000 || ms >= 5000));
  });

  it('reads an open ended span to the end of the source', async () => {
    const read = await framesRead([{ startSec: 4, endSec: Number.POSITIVE_INFINITY }]);
    expect(read.spanned).toEqual(read.whole.filter((ms) => ms >= 4000));
    expect(read.spanned.at(-1)).toEqual(read.whole.at(-1));
  });

  it('reads every frame when no span is given', async () => {
    const read = await framesRead([]);
    expect(read.whole).toHaveLength(FRAME_COUNT);
  });
});

interface FramesRead {
  /** Frame timestamps in ms from a single pass over the whole source. */
  whole: number[];
  /** Frame timestamps in ms from reading the given spans in order. */
  spanned: number[];
}

async function framesRead(spans: ReadonlyArray<{ startSec: number; endSec: number }>): Promise<FramesRead> {
  const page = await browser.newPage();
  try {
    // WebCodecs needs a secure context, which `about:blank` is not.
    await page.route('**/*', (route) => route.fulfill({
      contentType: 'text/html',
      body: '<title>decoder spans</title>',
    }));
    await page.goto('http://localhost/decoder-spans');
    await page.addScriptTag({ content: bundle });
    return await page.evaluate(readFramesInPage, {
      spans: spans.map((span) => ({
        startSec: span.startSec,
        // `Infinity` does not survive the hop into the page.
        endSec: Number.isFinite(span.endSec) ? span.endSec : null,
      })),
      fps: FPS,
      frameCount: FRAME_COUNT,
      size: SIZE,
      keyFrameIntervalSec: KEY_FRAME_INTERVAL_SEC,
    });
  } finally {
    await page.close();
  }
}

interface PageRequest {
  spans: ReadonlyArray<{ startSec: number; endSec: number | null }>;
  fps: number;
  frameCount: number;
  size: { width: number; height: number };
  keyFrameIntervalSec: number;
}

/** Encodes a source in the page and reads it back both ways. */
async function readFramesInPage(request: PageRequest): Promise<FramesRead> {
  const fixture = (window as unknown as { fixture: Record<string, never> }).fixture as unknown as {
    WebCodecsVideoFrameDecoder: new (track: unknown) => {
      samples: (span?: { startSec: number; endSec: number }) => AsyncIterable<{
        timestamp: number;
        close: () => void;
      }>;
      close: () => void;
    };
    ALL_FORMATS: unknown;
    BlobSource: new (blob: Blob) => unknown;
    BufferTarget: new () => { buffer: ArrayBuffer | null };
    CanvasSource: new (canvas: OffscreenCanvas, config: unknown) => unknown;
    Input: new (options: unknown) => { getPrimaryVideoTrack: () => Promise<unknown> };
    Mp4OutputFormat: new () => unknown;
    Output: new (options: unknown) => {
      addVideoTrack: (source: unknown) => unknown;
      start: () => Promise<void>;
      finalize: () => Promise<void>;
    };
  };

  const canvas = new OffscreenCanvas(request.size.width, request.size.height);
  const context = canvas.getContext('2d')!;
  const target = new fixture.BufferTarget();
  const output = new fixture.Output({ format: new fixture.Mp4OutputFormat(), target });
  const source = new fixture.CanvasSource(canvas, {
    codec: 'avc',
    bitrate: 1_000_000,
    keyFrameInterval: request.keyFrameIntervalSec,
  });
  output.addVideoTrack(source);
  await output.start();
  for (let index = 0; index < request.frameCount; index++) {
    context.fillStyle = `hsl(${(index * 137) % 360} 80% 50%)`;
    context.fillRect(0, 0, canvas.width, canvas.height);
    await (source as { add: (t: number, d: number) => Promise<void> })
      .add(index / request.fps, 1 / request.fps);
  }
  await output.finalize();

  const input = new fixture.Input({
    source: new fixture.BlobSource(new Blob([target.buffer!])),
    formats: fixture.ALL_FORMATS,
  });
  const track = await input.getPrimaryVideoTrack();

  const collect = async (span?: { startSec: number; endSec: number }): Promise<number[]> => {
    const decoder = new fixture.WebCodecsVideoFrameDecoder(track);
    const stamps: number[] = [];
    try {
      for await (const frame of decoder.samples(span)) {
        stamps.push(Math.round(frame.timestamp * 1000));
        frame.close();
      }
    } finally {
      decoder.close();
    }
    return stamps;
  };

  const whole = await collect();
  const spanned: number[] = [];
  for (const span of request.spans) {
    spanned.push(...await collect({
      startSec: span.startSec,
      endSec: span.endSec ?? Number.POSITIVE_INFINITY,
    }));
  }
  return { whole, spanned };
}

function fixtureModulePlugin(): Plugin {
  const resolved = `\0${FIXTURE_ID}`;
  return {
    name: 'seeked-spans-fixture',
    resolveId: (id) => (id === FIXTURE_ID ? resolved : null),
    load: (id) => (id === resolved ? FIXTURE_SOURCE : null),
  };
}

async function bundleForThePage(): Promise<string> {
  const result = await build({
    configFile: false,
    logLevel: 'error',
    plugins: [fixtureModulePlugin()],
    resolve: { alias: { '@modules': resolve(import.meta.dirname, '..', '..', '..') } },
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

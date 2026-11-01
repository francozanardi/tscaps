import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { resolve } from 'node:path';
import { chromium, type Browser } from '@playwright/test';
import { build, type Plugin } from 'vite';

/**
 * That a source whose bytes are gone partway through stops the read
 * with an error saying how far it got, asked of the decoder that reads
 * it.
 *
 * The damage is the kind a file picks up on its way to us: a stretch of
 * a frame overwritten with zeros, the index still pointing at it. The
 * frames before it decode, the frame itself does not.
 */

const FIXTURE_ID = 'virtual:damaged-frame-fixture';
const FIXTURE_SOURCE = `
  export { WebCodecsVideoFrameDecoder } from '@modules/video/mediabunny/frame/WebCodecsVideoFrameDecoder';
  export {
    ALL_FORMATS, BlobSource, BufferTarget, CanvasSource, EncodedPacketSink, Input, Mp4OutputFormat, Output,
  } from 'mediabunny';
`;

const FPS = 30;
const FRAME_COUNT = 90;
const SIZE = { width: 320, height: 240 };
const KEY_FRAME_INTERVAL_SEC = 1;
/** Not a key frame, and not the first frame after one. */
const DAMAGED_FRAME_SEC = 1.5;

let browser: Browser;
let bundle: string;

beforeAll(async () => {
  browser = await chromium.launch();
  bundle = await bundleForThePage();
}, 180_000);

afterAll(async () => { await browser.close(); });

describe('reading a source with a damaged frame', () => {
  it('stops with the decode failure, carrying the browser error', async () => {
    const read = await readDamagedSource(null);
    expect(read.errorName).toBe('VideoFrameDecodeFailedError');
    expect(read.causeName).toEqual(expect.any(String));
    expect(read.causeName).not.toBe('VideoFrameDecodeFailedError');
  });

  it('says it decoded up to the damage and no further', async () => {
    const read = await readDamagedSource(null);
    expect(read.decodedUntilSec).toBeGreaterThan(KEY_FRAME_INTERVAL_SEC);
    expect(read.decodedUntilSec).toBeLessThanOrEqual(DAMAGED_FRAME_SEC);
    expect(read.lastFrameEndSec).toBeCloseTo(read.decodedUntilSec!, 5);
  });

  it('counts from the start of the span when the damage is its first frame to decode', async () => {
    const read = await readDamagedSource({ startSec: DAMAGED_FRAME_SEC, endSec: 2 });
    expect(read.errorName).toBe('VideoFrameDecodeFailedError');
    expect(read.decodedUntilSec).toBe(DAMAGED_FRAME_SEC);
  });

  it('reads a span past the damage that starts at a key frame', async () => {
    const read = await readDamagedSource({ startSec: 2, endSec: 3 });
    expect(read.errorName).toBeNull();
    expect(read.framesRead).toBe(FPS);
  });
});

interface DamagedRead {
  errorName: string | null;
  causeName: string | null;
  decodedUntilSec: number | null;
  /** End of the last frame the read yielded, or `null` when it yielded none. */
  lastFrameEndSec: number | null;
  framesRead: number;
}

async function readDamagedSource(span: { startSec: number; endSec: number } | null): Promise<DamagedRead> {
  const page = await browser.newPage();
  try {
    // WebCodecs needs a secure context, which `about:blank` is not.
    await page.route('**/*', (route) => route.fulfill({
      contentType: 'text/html',
      body: '<title>damaged frame</title>',
    }));
    await page.goto('http://localhost/damaged-frame');
    await page.addScriptTag({ content: bundle });
    return await page.evaluate(readInPage, {
      span,
      fps: FPS,
      frameCount: FRAME_COUNT,
      size: SIZE,
      keyFrameIntervalSec: KEY_FRAME_INTERVAL_SEC,
      damagedFrameSec: DAMAGED_FRAME_SEC,
    });
  } finally {
    await page.close();
  }
}

interface PageRequest {
  span: { startSec: number; endSec: number } | null;
  fps: number;
  frameCount: number;
  size: { width: number; height: number };
  keyFrameIntervalSec: number;
  damagedFrameSec: number;
}

/** Encodes a source in the page, zeroes one frame's bytes in place, and reads it back. */
async function readInPage(request: PageRequest): Promise<DamagedRead> {
  const fixture = (window as unknown as { fixture: Record<string, never> }).fixture as unknown as {
    WebCodecsVideoFrameDecoder: new (track: unknown) => {
      samples: (span?: { startSec: number; endSec: number }) => AsyncIterable<{
        timestamp: number;
        duration: number;
        close: () => void;
      }>;
      close: () => void;
    };
    ALL_FORMATS: unknown;
    BlobSource: new (blob: Blob) => unknown;
    BufferTarget: new () => { buffer: ArrayBuffer | null };
    CanvasSource: new (canvas: OffscreenCanvas, config: unknown) => unknown;
    EncodedPacketSink: new (track: unknown) => {
      getPacket: (timestamp: number) => Promise<{ data: Uint8Array; timestamp: number } | null>;
    };
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
    context.fillStyle = 'white';
    context.fillRect((index * 7) % canvas.width, 40, 60, 60);
    await (source as { add: (t: number, d: number) => Promise<void> })
      .add(index / request.fps, 1 / request.fps);
  }
  await output.finalize();

  const bytes = new Uint8Array(target.buffer!);
  const intact = new fixture.Input({ source: new fixture.BlobSource(new Blob([bytes])), formats: fixture.ALL_FORMATS });
  const packet = await new fixture.EncodedPacketSink(await intact.getPrimaryVideoTrack())
    .getPacket(request.damagedFrameSec);
  const offset = indexOfBytes(bytes, packet!.data);
  bytes.fill(0, offset, offset + packet!.data.length);

  const damaged = new fixture.Input({ source: new fixture.BlobSource(new Blob([bytes])), formats: fixture.ALL_FORMATS });
  const decoder = new fixture.WebCodecsVideoFrameDecoder(await damaged.getPrimaryVideoTrack());
  let lastFrameEndSec: number | null = null;
  let framesRead = 0;
  try {
    for await (const frame of decoder.samples(request.span ?? undefined)) {
      lastFrameEndSec = frame.timestamp + frame.duration;
      framesRead++;
      frame.close();
    }
    return { errorName: null, causeName: null, decodedUntilSec: null, lastFrameEndSec, framesRead };
  } catch (error) {
    const failure = error as { name: string; decodedUntilSec?: number; cause?: { name?: string } };
    return {
      errorName: failure.name,
      causeName: failure.cause?.name ?? null,
      decodedUntilSec: failure.decodedUntilSec ?? null,
      lastFrameEndSec,
      framesRead,
    };
  } finally {
    decoder.close();
  }

  function indexOfBytes(haystack: Uint8Array, needle: Uint8Array): number {
    const head = needle.subarray(0, 32);
    for (let start = 0; start <= haystack.length - needle.length; start++) {
      let matches = true;
      for (let index = 0; index < head.length; index++) {
        if (haystack[start + index] !== head[index]) { matches = false; break; }
      }
      if (matches) return start;
    }
    throw new Error('The packet was not found in the file');
  }
}

function fixtureModulePlugin(): Plugin {
  const resolved = `\0${FIXTURE_ID}`;
  return {
    name: 'damaged-frame-fixture',
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

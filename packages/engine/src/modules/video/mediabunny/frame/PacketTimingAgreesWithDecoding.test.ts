import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { resolve } from 'node:path';
import { chromium, type Browser } from '@playwright/test';
import { build, type Plugin } from 'vite';

/**
 * That timing a source from its packets yields the frames decoding it
 * would, asked of the decoder that would have decoded it.
 *
 * A render that never draws the source still takes every output frame's
 * time from it. One frame more or less, or one time off, and the output
 * no longer lines up frame for frame with the video it was made for.
 */

const FIXTURE_ID = 'virtual:packet-timing-fixture';
const FIXTURE_SOURCE = `
  export { WebCodecsVideoFrameDecoder } from '@modules/video/mediabunny/frame/WebCodecsVideoFrameDecoder';
  export { PacketTimingVideoFrameDecoder } from '@modules/video/mediabunny/frame/PacketTimingVideoFrameDecoder';
  export { MediaBunnyTranscodeCoordinator } from '@modules/video/mediabunny/MediaBunnyTranscodeCoordinator';
  export { DefaultVideoFrameDecoderFactory } from '@modules/video/mediabunny/frame/DefaultVideoFrameDecoderFactory';
  export { MediaBunnyCanvasVideoTrackEncoderFactory } from '@modules/video/mediabunny/encoder/MediaBunnyCanvasVideoTrackEncoderFactory';
  export { DefaultAudioTrackBridgeFactory } from '@modules/video/mediabunny/audio/DefaultAudioTrackBridgeFactory';
  export { MediaBunnyOutputTargetBuilder } from '@modules/video/mediabunny/output/MediaBunnyOutputTargetBuilder';
  export { DefaultCodecPolicy } from '@modules/video/mediabunny/codec/DefaultCodecPolicy';
  export {
    ALL_FORMATS, BlobSource, BufferTarget, CanvasSource, EncodedPacketSink, Input, Mp4OutputFormat, Output,
  } from 'mediabunny';
`;

const FPS = 30;
const FRAME_COUNT = 90;
const SIZE = { width: 320, height: 240 };

let browser: Browser;
let bundle: string;

beforeAll(async () => {
  browser = await chromium.launch();
  bundle = await bundleForThePage();
}, 180_000);

afterAll(async () => { await browser.close(); });

describe('timing a source from its packets', () => {
  it('yields the frames decoding it yields, at the same times and for as long', async () => {
    const read = await readInPage([]);
    expect(read.timed).toEqual(read.decoded);
    expect(read.timed).toHaveLength(FRAME_COUNT);
  });

  it('yields the frames of a span that decoding the span yields', async () => {
    const read = await readInPage([{ startSec: 1, endSec: 2 }, { startSec: 2.5, endSec: null }]);
    expect(read.timed).toEqual(read.decoded);
  });

  it('times a transcode that never draws the source, frame for frame, with a painter that gathers runs', async () => {
    const read = await readInPage([], true);
    expect(read.transcodedFrameCount).toBe(FRAME_COUNT);
  });
});

interface TimingsRead {
  /** `timestamp:duration` in ms per frame, from decoding each span. */
  decoded: string[];
  /** The same, from the packets alone. */
  timed: string[];
  /** Frames in a transcode of the whole source that never decoded it, or `null` when none was asked for. */
  transcodedFrameCount: number | null;
}

async function readInPage(
  spans: ReadonlyArray<{ startSec: number; endSec: number | null }>,
  transcode = false,
): Promise<TimingsRead> {
  const page = await browser.newPage();
  try {
    // WebCodecs needs a secure context, which `about:blank` is not.
    await page.route('**/*', (route) => route.fulfill({ contentType: 'text/html', body: '<title>packet timing</title>' }));
    await page.goto('http://localhost/packet-timing');
    await page.addScriptTag({ content: bundle });
    return await page.evaluate(readTimingsInPage, { spans, transcode, fps: FPS, frameCount: FRAME_COUNT, size: SIZE });
  } finally {
    await page.close();
  }
}

interface PageRequest {
  spans: ReadonlyArray<{ startSec: number; endSec: number | null }>;
  transcode: boolean;
  fps: number;
  frameCount: number;
  size: { width: number; height: number };
}

/** Encodes a source in the page, reads its frames both ways, and transcodes it without decoding. */
async function readTimingsInPage(request: PageRequest): Promise<TimingsRead> {
  interface Frame { timestamp: number; duration: number; close: () => void }
  interface Decoder { samples: (span?: { startSec: number; endSec: number }) => AsyncIterable<Frame>; close: () => void }
  const fixture = (window as unknown as { fixture: unknown }).fixture as {
    WebCodecsVideoFrameDecoder: new (track: unknown) => Decoder;
    PacketTimingVideoFrameDecoder: new (track: unknown) => Decoder;
    MediaBunnyTranscodeCoordinator: new (config: unknown) => { execute: (request: unknown) => Promise<{ blob: Blob | null }> };
    DefaultVideoFrameDecoderFactory: new () => unknown;
    MediaBunnyCanvasVideoTrackEncoderFactory: new () => unknown;
    DefaultAudioTrackBridgeFactory: new () => unknown;
    MediaBunnyOutputTargetBuilder: new () => unknown;
    DefaultCodecPolicy: new () => unknown;
    ALL_FORMATS: unknown;
    BlobSource: new (blob: Blob) => unknown;
    BufferTarget: new () => { buffer: ArrayBuffer | null };
    CanvasSource: new (canvas: OffscreenCanvas, config: unknown) => { add: (t: number, d: number) => Promise<void> };
    EncodedPacketSink: new (track: unknown) => { packets: () => AsyncIterable<unknown> };
    Input: new (options: unknown) => { getPrimaryVideoTrack: () => Promise<unknown> };
    Mp4OutputFormat: new () => unknown;
    Output: new (options: unknown) => { addVideoTrack: (source: unknown) => unknown; start: () => Promise<void>; finalize: () => Promise<void> };
  };

  const canvas = new OffscreenCanvas(request.size.width, request.size.height);
  const context = canvas.getContext('2d')!;
  const target = new fixture.BufferTarget();
  const output = new fixture.Output({ format: new fixture.Mp4OutputFormat(), target });
  const source = new fixture.CanvasSource(canvas, { codec: 'avc', bitrate: 1_000_000, keyFrameInterval: 1 });
  output.addVideoTrack(source);
  await output.start();
  for (let index = 0; index < request.frameCount; index++) {
    context.fillStyle = `hsl(${(index * 137) % 360} 80% 50%)`;
    context.fillRect(0, 0, canvas.width, canvas.height);
    await source.add(index / request.fps, 1 / request.fps);
  }
  await output.finalize();
  const sourceBytes = target.buffer!;
  const input = new fixture.Input({ source: new fixture.BlobSource(new Blob([sourceBytes])), formats: fixture.ALL_FORMATS });
  const track = await input.getPrimaryVideoTrack();

  const spans = request.spans.length === 0
    ? [undefined]
    : request.spans.map((span) => ({ startSec: span.startSec, endSec: span.endSec ?? Number.POSITIVE_INFINITY }));
  const collect = async (decoder: Decoder): Promise<string[]> => {
    const frames: string[] = [];
    try {
      for (const span of spans) {
        for await (const frame of decoder.samples(span)) {
          frames.push(`${Math.round(frame.timestamp * 1000)}:${Math.round(frame.duration * 1000)}`);
          frame.close();
        }
      }
    } finally {
      decoder.close();
    }
    return frames;
  };
  const decoded = await collect(new fixture.WebCodecsVideoFrameDecoder(track));
  const timed = await collect(new fixture.PacketTimingVideoFrameDecoder(track));
  if (!request.transcode) return { decoded, timed, transcodedFrameCount: null };

  const coordinator = new fixture.MediaBunnyTranscodeCoordinator({
    videoFrameDecoderFactory: new fixture.DefaultVideoFrameDecoderFactory(),
    videoTrackEncoderFactory: new fixture.MediaBunnyCanvasVideoTrackEncoderFactory(),
    audioTrackBridgeFactory: new fixture.DefaultAudioTrackBridgeFactory(),
    outputTargetBuilder: new fixture.MediaBunnyOutputTargetBuilder(),
  });
  const result = await coordinator.execute({
    source: new File([sourceBytes], 'source.mp4', { type: 'video/mp4' }),
    codecPolicy: new fixture.DefaultCodecPolicy(),
    sourcePixels: false,
    painter: {
      begin: async () => {},
      lookAhead: () => 4,
      paint: async (requests: ReadonlyArray<unknown>) => requests.map(() => (ctx: OffscreenCanvasRenderingContext2D) => {
        ctx.fillStyle = '#00ff00';
        ctx.fillRect(0, 0, request.size.width, request.size.height);
      }),
      end: () => {},
    },
  });
  const output2 = new fixture.Input({ source: new fixture.BlobSource(result.blob!), formats: fixture.ALL_FORMATS });
  let transcodedFrameCount = 0;
  for await (const packet of new fixture.EncodedPacketSink(await output2.getPrimaryVideoTrack()).packets()) {
    if (packet) transcodedFrameCount++;
  }
  return { decoded, timed, transcodedFrameCount };
}

function fixtureModulePlugin(): Plugin {
  const resolved = `\0${FIXTURE_ID}`;
  return {
    name: 'packet-timing-fixture',
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

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { resolve } from 'node:path';
import { chromium, type Browser } from '@playwright/test';
import { build, type Plugin } from 'vite';

/**
 * That a transcode with no painter, which hands the decoded frames to the
 * encoder as they are, writes the video a painter drawing each source
 * frame unchanged would: the same size on screen, the same frames at the
 * same times, the same picture.
 *
 * The two files are not alike inside. A rotated source keeps its rotation
 * as metadata in one and has it drawn into the pixels of the other, so
 * each file is read back through a demuxer and a decoder that apply the
 * rotation, which is how anything that plays it sees it.
 */

const FIXTURE_ID = 'virtual:unpainted-output-fixture';
const FIXTURE_SOURCE = `
  export { MediaBunnyTranscodeCoordinator } from '@modules/video/mediabunny/MediaBunnyTranscodeCoordinator';
  export { DefaultVideoFrameDecoderFactory } from '@modules/video/mediabunny/frame/DefaultVideoFrameDecoderFactory';
  export { MediaBunnyCanvasVideoTrackEncoderFactory } from '@modules/video/mediabunny/encoder/MediaBunnyCanvasVideoTrackEncoderFactory';
  export { ProbingVideoEncoderAccelerationPolicy } from '@modules/video/mediabunny/encoder/ProbingVideoEncoderAccelerationPolicy';
  export { DefaultAudioTrackBridgeFactory } from '@modules/video/mediabunny/audio/DefaultAudioTrackBridgeFactory';
  export { MediaBunnyOutputTargetBuilder } from '@modules/video/mediabunny/output/MediaBunnyOutputTargetBuilder';
  export { DefaultCodecPolicy } from '@modules/video/mediabunny/codec/DefaultCodecPolicy';
  export {
    ALL_FORMATS, BlobSource, BufferTarget, CanvasSink, CanvasSource, EncodedPacketSink, Input, Mp4OutputFormat, Output,
  } from 'mediabunny';
`;

/** The source's frames as stored: wider than tall, so a rotation that goes missing shows in the size. */
const STORED = { width: 320, height: 192 };
const FPS = 30;
const FRAME_COUNT = 30;
/** The colour of each quarter of every source frame as stored: top left, top right, bottom left, bottom right. */
const QUARTERS = ['#e01010', '#10c010', '#1010e0', '#e0e010'] as const;

let browser: Browser;
let bundle: string;

beforeAll(async () => {
  browser = await chromium.launch();
  bundle = await bundleForThePage();
}, 180_000);

afterAll(async () => { await browser.close(); });

describe('a transcode with no painter', () => {
  it('writes the video that painting each source frame unchanged writes', async () => {
    const { painted, unpainted } = await transcodeBothWays({ sourceRotation: 0 });

    expect(unpainted.displayed).toBe('320x192');
    expect(unpainted.displayed).toBe(painted.displayed);
    expect(unpainted.timestamps).toHaveLength(FRAME_COUNT);
    expect(unpainted.timestamps).toEqual(painted.timestamps);
    expectSamePicture(unpainted.quarters, painted.quarters);
    expectSamePicture(unpainted.quarters, QUARTERS.map(rgbOf));
  });

  it('keeps a rotated source rotated by metadata, and it shows as the painted one does', async () => {
    const { painted, unpainted } = await transcodeBothWays({ sourceRotation: 90 });

    expect(unpainted.rotation).toBe(90);
    expect(unpainted.stored).toBe('320x192');
    expect(painted.rotation).toBe(0);
    expect(painted.stored).toBe('192x320');
    expect(unpainted.displayed).toBe('192x320');
    expect(unpainted.displayed).toBe(painted.displayed);
    expect(unpainted.timestamps).toEqual(painted.timestamps);
    expectSamePicture(unpainted.quarters, painted.quarters);
    // Turned a quarter clockwise, the stored bottom left ends up top left.
    expectSamePicture(unpainted.quarters, [QUARTERS[2], QUARTERS[0], QUARTERS[3], QUARTERS[1]].map(rgbOf));
  });

  it('is refused when asked for an output smaller than the source', async () => {
    const outcome = await transcodeUnpaintedOnly({ sourceRotation: 0, outputFormat: 'mp4', outputResolution: { width: 160, height: 96 } });
    expect(outcome).toBe('rejected');
  });

  it('is refused for a rotated source in a format that cannot say so', async () => {
    const outcome = await transcodeUnpaintedOnly({ sourceRotation: 90, outputFormat: 'webm' });
    expect(outcome).toBe('rejected');
  });
});

/** Each channel of each quarter within what two encodes of the same frames drift apart by. */
function expectSamePicture(actual: ReadonlyArray<ReadonlyArray<number>>, expected: ReadonlyArray<ReadonlyArray<number>>): void {
  for (const [quarter, colour] of expected.entries()) {
    for (const [channel, value] of colour.entries()) {
      expect(Math.abs(actual[quarter]![channel]! - value), `quarter ${quarter}, channel ${channel}`).toBeLessThanOrEqual(24);
    }
  }
}

function rgbOf(hex: string): number[] {
  return [1, 3, 5].map((offset) => parseInt(hex.slice(offset, offset + 2), 16));
}

interface FileRead {
  rotation: number;
  /** Width x height of the frames as the file stores them. */
  stored: string;
  /** Width x height once the rotation is applied, as a player shows them. */
  displayed: string;
  /** Presentation time of every video packet, in milliseconds. */
  timestamps: number[];
  /** RGB at the middle of each quarter of the middle frame, as displayed: top left, top right, bottom left, bottom right. */
  quarters: number[][];
}

interface SourceRequest {
  sourceRotation: 0 | 90;
}

interface UnpaintedRequest extends SourceRequest {
  outputFormat: 'mp4' | 'webm';
  outputResolution?: { width: number; height: number };
}

async function transcodeBothWays(request: SourceRequest): Promise<{ painted: FileRead; unpainted: FileRead }> {
  return inPage((page) => page.evaluate(transcodeAndReadBack, { ...pageConstants(), ...request, mode: 'both' as const })) as
    Promise<{ painted: FileRead; unpainted: FileRead }>;
}

async function transcodeUnpaintedOnly(request: UnpaintedRequest): Promise<'written' | 'rejected'> {
  return inPage((page) => page.evaluate(transcodeAndReadBack, { ...pageConstants(), ...request, mode: 'unpainted' as const })) as
    Promise<'written' | 'rejected'>;
}

function pageConstants() {
  return { stored: STORED, fps: FPS, frameCount: FRAME_COUNT, quarterColours: [...QUARTERS] };
}

async function inPage<T>(work: (page: import('@playwright/test').Page) => Promise<T>): Promise<T> {
  const page = await browser.newPage();
  try {
    // WebCodecs needs a secure context, which `about:blank` is not.
    await page.route('**/*', (route) => route.fulfill({
      contentType: 'text/html',
      body: '<title>unpainted output</title>',
    }));
    await page.goto('http://localhost/unpainted-output');
    await page.addScriptTag({ content: bundle });
    return await work(page);
  } finally {
    await page.close();
  }
}

interface PageRequest {
  stored: { width: number; height: number };
  fps: number;
  frameCount: number;
  quarterColours: string[];
  sourceRotation: 0 | 90;
  mode: 'both' | 'unpainted';
  outputFormat?: 'mp4' | 'webm';
  outputResolution?: { width: number; height: number };
}

/**
 * Encodes a source whose frames are four coloured quarters, with the
 * rotation asked for as metadata, then transcodes it with a painter that
 * draws each source frame unchanged and without a painter, and reads
 * both files back. In `unpainted` mode, only says whether the run without
 * a painter was written.
 */
async function transcodeAndReadBack(request: PageRequest): Promise<unknown> {
  const fixture = (window as unknown as { fixture: Record<string, unknown> }).fixture as unknown as {
    MediaBunnyTranscodeCoordinator: new (config: unknown) => {
      execute: (request: unknown) => Promise<{ blob: Blob | null }>;
    };
    DefaultVideoFrameDecoderFactory: new () => unknown;
    MediaBunnyCanvasVideoTrackEncoderFactory: new () => unknown;
    ProbingVideoEncoderAccelerationPolicy: new () => unknown;
    DefaultAudioTrackBridgeFactory: new () => unknown;
    MediaBunnyOutputTargetBuilder: new () => unknown;
    DefaultCodecPolicy: new () => unknown;
    ALL_FORMATS: unknown;
    BlobSource: new (blob: Blob) => unknown;
    BufferTarget: new () => { buffer: ArrayBuffer | null };
    CanvasSink: new (track: unknown) => {
      getCanvas: (time: number) => Promise<{ canvas: OffscreenCanvas | HTMLCanvasElement } | null>;
    };
    CanvasSource: new (canvas: OffscreenCanvas, config: unknown) => {
      add: (timestamp: number, duration: number) => Promise<void>;
    };
    EncodedPacketSink: new (track: unknown) => { packets: () => AsyncIterable<{ timestamp: number }> };
    Input: new (options: unknown) => {
      getPrimaryVideoTrack: () => Promise<{
        getRotation: () => Promise<number>;
        getCodedWidth: () => Promise<number>;
        getCodedHeight: () => Promise<number>;
        getDisplayWidth: () => Promise<number>;
        getDisplayHeight: () => Promise<number>;
      } | null>;
    };
    Mp4OutputFormat: new () => unknown;
    Output: new (options: unknown) => {
      addVideoTrack: (source: unknown, metadata?: unknown) => unknown;
      start: () => Promise<void>;
      finalize: () => Promise<void>;
    };
  };

  const { width, height } = request.stored;
  const sourceCanvas = new OffscreenCanvas(width, height);
  const sourceContext = sourceCanvas.getContext('2d')!;
  const sourceTarget = new fixture.BufferTarget();
  const sourceOutput = new fixture.Output({ format: new fixture.Mp4OutputFormat(), target: sourceTarget });
  const canvasSource = new fixture.CanvasSource(sourceCanvas, { codec: 'avc', bitrate: 2_000_000 });
  sourceOutput.addVideoTrack(canvasSource, { rotation: request.sourceRotation });
  await sourceOutput.start();
  const [topLeft, topRight, bottomLeft, bottomRight] = request.quarterColours;
  for (let index = 0; index < request.frameCount; index++) {
    const quarters: Array<[string, number, number]> = [
      [topLeft!, 0, 0], [topRight!, width / 2, 0], [bottomLeft!, 0, height / 2], [bottomRight!, width / 2, height / 2],
    ];
    for (const [colour, x, y] of quarters) {
      sourceContext.fillStyle = colour;
      sourceContext.fillRect(x, y, width / 2, height / 2);
    }
    await canvasSource.add(index / request.fps, 1 / request.fps);
  }
  await sourceOutput.finalize();
  const source = new File([sourceTarget.buffer!], 'source.mp4', { type: 'video/mp4' });

  const coordinator = new fixture.MediaBunnyTranscodeCoordinator({
    videoFrameDecoderFactory: new fixture.DefaultVideoFrameDecoderFactory(),
    videoTrackEncoderFactory: new fixture.MediaBunnyCanvasVideoTrackEncoderFactory(),
    videoEncoderAccelerationPolicy: new fixture.ProbingVideoEncoderAccelerationPolicy(),
    audioTrackBridgeFactory: new fixture.DefaultAudioTrackBridgeFactory(),
    outputTargetBuilder: new fixture.MediaBunnyOutputTargetBuilder(),
  });

  const readBack = async (file: Blob) => {
    const input = new fixture.Input({ source: new fixture.BlobSource(file), formats: fixture.ALL_FORMATS });
    const track = (await input.getPrimaryVideoTrack())!;
    const timestamps: number[] = [];
    for await (const packet of new fixture.EncodedPacketSink(track).packets()) {
      timestamps.push(Math.round(packet.timestamp * 1000));
    }
    timestamps.sort((a, b) => a - b);
    const displayWidth = await track.getDisplayWidth();
    const displayHeight = await track.getDisplayHeight();
    const middle = await new fixture.CanvasSink(track).getCanvas(request.frameCount / request.fps / 2);
    const context = (middle!.canvas as OffscreenCanvas).getContext('2d')!;
    const at = (x: number, y: number) => [...context.getImageData(Math.round(x), Math.round(y), 1, 1).data.slice(0, 3)];
    return {
      rotation: await track.getRotation(),
      stored: `${await track.getCodedWidth()}x${await track.getCodedHeight()}`,
      displayed: `${displayWidth}x${displayHeight}`,
      timestamps,
      quarters: [
        at(displayWidth / 4, displayHeight / 4), at((displayWidth * 3) / 4, displayHeight / 4),
        at(displayWidth / 4, (displayHeight * 3) / 4), at((displayWidth * 3) / 4, (displayHeight * 3) / 4),
      ],
    };
  };

  if (request.mode === 'unpainted') {
    try {
      await coordinator.execute({
        source,
        codecPolicy: new fixture.DefaultCodecPolicy(),
        outputFormat: request.outputFormat,
        ...(request.outputResolution ? { outputResolution: request.outputResolution } : {}),
      });
      return 'written';
    } catch {
      return 'rejected';
    }
  }

  let size = { width: 0, height: 0 };
  const sourceAsIs = {
    begin: async (outputWidth: number, outputHeight: number) => { size = { width: outputWidth, height: outputHeight }; },
    lookAhead: () => 1,
    paint: async (requests: ReadonlyArray<{ frame: { draw: (...args: unknown[]) => void } }>) =>
      requests.map(({ frame }) => (target: OffscreenCanvasRenderingContext2D) => frame.draw(target, 0, 0, size.width, size.height)),
    end: () => {},
  };
  const painted = await coordinator.execute({ source, codecPolicy: new fixture.DefaultCodecPolicy(), painter: sourceAsIs, outputFormat: 'mp4' });
  const unpainted = await coordinator.execute({ source, codecPolicy: new fixture.DefaultCodecPolicy(), outputFormat: 'mp4' });
  return { painted: await readBack(painted.blob!), unpainted: await readBack(unpainted.blob!) };
}

function fixtureModulePlugin(): Plugin {
  const resolved = `\0${FIXTURE_ID}`;
  return {
    name: 'unpainted-output-fixture',
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

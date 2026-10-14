import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { resolve } from 'node:path';
import { chromium, type Browser } from '@playwright/test';
import { build, type Plugin } from 'vite';

/**
 * That a transcode asked to keep alpha writes a file whose frames read
 * back transparent wherever the painter left them so, asked of a
 * decoder rather than of our own bookkeeping.
 *
 * The encoder never sees transparency itself: the frames are split into
 * a colour and an alpha stream on their way in, and the canvas they are
 * painted on has to keep the channel for there to be anything to split.
 * Any link of that chain can drop it silently and still write a valid,
 * fully opaque file.
 */

const FIXTURE_ID = 'virtual:transparent-output-fixture';
const FIXTURE_SOURCE = `
  export { MediaBunnyTranscodeCoordinator } from '@modules/video/mediabunny/MediaBunnyTranscodeCoordinator';
  export { DefaultVideoFrameDecoderFactory } from '@modules/video/mediabunny/frame/DefaultVideoFrameDecoderFactory';
  export { MediaBunnyCanvasVideoTrackEncoderFactory } from '@modules/video/mediabunny/encoder/MediaBunnyCanvasVideoTrackEncoderFactory';
  export { DefaultAudioTrackBridgeFactory } from '@modules/video/mediabunny/audio/DefaultAudioTrackBridgeFactory';
  export { MediaBunnyOutputTargetBuilder } from '@modules/video/mediabunny/output/MediaBunnyOutputTargetBuilder';
  export { DefaultCodecPolicy } from '@modules/video/mediabunny/codec/DefaultCodecPolicy';
  export {
    ALL_FORMATS, BlobSource, BufferTarget, CanvasSink, CanvasSource, Input, Mp4OutputFormat, Output,
  } from 'mediabunny';
`;

const SIZE = { width: 320, height: 240 };
const FPS = 30;
const FRAME_COUNT = 30;

let browser: Browser;
let bundle: string;

beforeAll(async () => {
  browser = await chromium.launch();
  bundle = await bundleForThePage();
}, 180_000);

afterAll(async () => { await browser.close(); });

describe('a transcode that keeps alpha', () => {
  it('reads back transparent where nothing was painted and opaque where something was', async () => {
    const read = await transcodeInPage({ alpha: true, outputFormat: 'webm' });
    expect(read.outcome).toBe('written');
    expect(read.canBeTransparent).toBe(true);
    expect(read.unpaintedAlpha).toBe(0);
    expect(read.paintedAlpha).toBeGreaterThan(250);
    expect(read.paintedRed).toBeGreaterThan(200);
  });

  it('reads back fully opaque when alpha is not asked for, so the channel is the request and not an accident', async () => {
    const read = await transcodeInPage({ alpha: false, outputFormat: 'webm' });
    expect(read.outcome).toBe('written');
    expect(read.unpaintedAlpha).toBe(255);
  });

  it('is refused for a format that cannot carry alpha', async () => {
    const read = await transcodeInPage({ alpha: true, outputFormat: 'mp4' });
    expect(read.outcome).toBe('rejected');
  });
});

interface TranscodeRequest {
  alpha: boolean;
  outputFormat: 'mp4' | 'webm';
}

interface TranscodeRead {
  outcome: 'written' | 'rejected';
  canBeTransparent: boolean | null;
  /** Alpha of a pixel the painter never touched, in the middle frame. */
  unpaintedAlpha: number | null;
  /** Alpha of a pixel the painter filled opaque red, in the middle frame. */
  paintedAlpha: number | null;
  paintedRed: number | null;
}

async function transcodeInPage(request: TranscodeRequest): Promise<TranscodeRead> {
  const page = await browser.newPage();
  try {
    // WebCodecs needs a secure context, which `about:blank` is not.
    await page.route('**/*', (route) => route.fulfill({
      contentType: 'text/html',
      body: '<title>transparent output</title>',
    }));
    await page.goto('http://localhost/transparent-output');
    await page.addScriptTag({ content: bundle });
    return await page.evaluate(transcodeAndReadBack, {
      ...request,
      size: SIZE,
      fps: FPS,
      frameCount: FRAME_COUNT,
    });
  } finally {
    await page.close();
  }
}

interface PageRequest extends TranscodeRequest {
  size: { width: number; height: number };
  fps: number;
  frameCount: number;
}

/**
 * Encodes an opaque source, transcodes it with a painter that fills only
 * the left half red and leaves the right half alone, then decodes the
 * middle frame of the result and samples one pixel on each side.
 */
async function transcodeAndReadBack(request: PageRequest): Promise<TranscodeRead> {
  type Fixture = Record<string, new (...args: never[]) => never> & { ALL_FORMATS: unknown };
  const fixture = (window as unknown as { fixture: Fixture }).fixture as unknown as {
    MediaBunnyTranscodeCoordinator: new (config: unknown) => {
      execute: (request: unknown) => Promise<{ blob: Blob | null }>;
    };
    DefaultVideoFrameDecoderFactory: new () => unknown;
    MediaBunnyCanvasVideoTrackEncoderFactory: new () => unknown;
    DefaultAudioTrackBridgeFactory: new () => unknown;
    MediaBunnyOutputTargetBuilder: new () => unknown;
    DefaultCodecPolicy: new () => unknown;
    ALL_FORMATS: unknown;
    BlobSource: new (blob: Blob) => unknown;
    BufferTarget: new () => { buffer: ArrayBuffer | null };
    CanvasSink: new (track: unknown, options: unknown) => {
      getCanvas: (time: number) => Promise<{ canvas: OffscreenCanvas | HTMLCanvasElement } | null>;
    };
    CanvasSource: new (canvas: OffscreenCanvas, config: unknown) => {
      add: (timestamp: number, duration: number) => Promise<void>;
    };
    Input: new (options: unknown) => {
      getPrimaryVideoTrack: () => Promise<{ canBeTransparent: () => Promise<boolean> } | null>;
    };
    Mp4OutputFormat: new () => unknown;
    Output: new (options: unknown) => {
      addVideoTrack: (source: unknown) => unknown;
      start: () => Promise<void>;
      finalize: () => Promise<void>;
    };
  };

  const { width, height } = request.size;
  const sourceCanvas = new OffscreenCanvas(width, height);
  const sourceContext = sourceCanvas.getContext('2d')!;
  const sourceTarget = new fixture.BufferTarget();
  const sourceOutput = new fixture.Output({ format: new fixture.Mp4OutputFormat(), target: sourceTarget });
  const canvasSource = new fixture.CanvasSource(sourceCanvas, { codec: 'avc', bitrate: 1_000_000 });
  sourceOutput.addVideoTrack(canvasSource);
  await sourceOutput.start();
  for (let index = 0; index < request.frameCount; index++) {
    sourceContext.fillStyle = '#2050c0';
    sourceContext.fillRect(0, 0, width, height);
    await canvasSource.add(index / request.fps, 1 / request.fps);
  }
  await sourceOutput.finalize();

  const coordinator = new fixture.MediaBunnyTranscodeCoordinator({
    videoFrameDecoderFactory: new fixture.DefaultVideoFrameDecoderFactory(),
    videoTrackEncoderFactory: new fixture.MediaBunnyCanvasVideoTrackEncoderFactory(),
    audioTrackBridgeFactory: new fixture.DefaultAudioTrackBridgeFactory(),
    outputTargetBuilder: new fixture.MediaBunnyOutputTargetBuilder(),
  });
  const painter = {
    begin: async () => {},
    lookAhead: () => 1,
    paint: async (requests: ReadonlyArray<unknown>) => requests.map(() => (context: OffscreenCanvasRenderingContext2D) => {
      context.fillStyle = '#ff0000';
      context.fillRect(0, 0, width / 2, height);
    }),
    end: () => {},
  };

  let result: { blob: Blob | null };
  try {
    result = await coordinator.execute({
      source: new File([sourceTarget.buffer!], 'source.mp4', { type: 'video/mp4' }),
      codecPolicy: new fixture.DefaultCodecPolicy(),
      painter,
      alpha: request.alpha,
      outputFormat: request.outputFormat,
    });
  } catch {
    return { outcome: 'rejected', canBeTransparent: null, unpaintedAlpha: null, paintedAlpha: null, paintedRed: null };
  }

  const input = new fixture.Input({ source: new fixture.BlobSource(result.blob!), formats: fixture.ALL_FORMATS });
  const track = await input.getPrimaryVideoTrack();
  const sink = new fixture.CanvasSink(track, { alpha: true });
  const wrapped = await sink.getCanvas(request.frameCount / request.fps / 2);
  const context = (wrapped!.canvas as OffscreenCanvas).getContext('2d')!;
  const unpainted = context.getImageData((width * 3) / 4, height / 2, 1, 1).data;
  const painted = context.getImageData(width / 4, height / 2, 1, 1).data;
  return {
    outcome: 'written',
    canBeTransparent: await track!.canBeTransparent(),
    unpaintedAlpha: unpainted[3]!,
    paintedAlpha: painted[3]!,
    paintedRed: painted[0]!,
  };
}

function fixtureModulePlugin(): Plugin {
  const resolved = `\0${FIXTURE_ID}`;
  return {
    name: 'transparent-output-fixture',
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

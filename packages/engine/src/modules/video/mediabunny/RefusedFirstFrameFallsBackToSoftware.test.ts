import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { resolve } from 'node:path';
import { chromium, type Browser } from '@playwright/test';
import { build, type Plugin } from 'vite';

/**
 * That a run whose default video encoder refuses the first frame is
 * written through a software encoder instead, and that the software
 * encoder is only trusted once it has been seen to work.
 *
 * Some Windows hardware encoders accept the config and then fail the
 * very first frame with `OperationError: Encoding error. (Unexpected
 * frame format.)`. No machine available to the tests has one, so the
 * page's `VideoEncoder` is replaced by the real one wrapped to fail the
 * same way; everything else — canvas, mediabunny, muxer, decoder reading
 * the result back — is the browser's own.
 */

const FIXTURE_ID = 'virtual:refused-first-frame-fixture';
const FIXTURE_SOURCE = `
  export { MediaBunnyTranscodeCoordinator } from '@modules/video/mediabunny/MediaBunnyTranscodeCoordinator';
  export { DefaultVideoFrameDecoderFactory } from '@modules/video/mediabunny/frame/DefaultVideoFrameDecoderFactory';
  export { MediaBunnyCanvasVideoTrackEncoderFactory } from '@modules/video/mediabunny/encoder/MediaBunnyCanvasVideoTrackEncoderFactory';
  export { ProbingVideoEncoderAccelerationPolicy } from '@modules/video/mediabunny/encoder/ProbingVideoEncoderAccelerationPolicy';
  export { DefaultAudioTrackBridgeFactory } from '@modules/video/mediabunny/audio/DefaultAudioTrackBridgeFactory';
  export { MediaBunnyOutputTargetBuilder } from '@modules/video/mediabunny/output/MediaBunnyOutputTargetBuilder';
  export { DefaultCodecPolicy } from '@modules/video/mediabunny/codec/DefaultCodecPolicy';
  export { ALL_FORMATS, BlobSource, BufferTarget, CanvasSource, Input, Mp4OutputFormat, Output } from 'mediabunny';
`;

const SIZE = { width: 320, height: 240 };
const FPS = 30;
const FRAME_COUNT = 15;

/**
 * How the page's encoder misbehaves.
 * - `none`: the browser's encoder, untouched.
 * - `default-refuses`: any encoder not asked for software refuses its first frame.
 * - `every-encoder-refuses`: software refuses it too.
 * - `software-unsupported`: the default refuses, and `isConfigSupported` turns software down.
 */
type EncoderFault = 'none' | 'default-refuses' | 'every-encoder-refuses' | 'software-unsupported';

interface RunRead {
  outcome: 'written' | 'failed';
  failure: string | null;
  selection: {
    acceleration: string;
    defaultEncoderFailure: string | null;
    softwareEncoderFailure: string | null;
  } | null;
  /** Video packets in the written file, read back by a demuxer. */
  packetCount: number | null;
}

let browser: Browser;
let bundle: string;

beforeAll(async () => {
  browser = await chromium.launch();
  bundle = await bundleForThePage();
}, 180_000);

afterAll(async () => { await browser.close(); });

describe('a run whose default video encoder refuses the first frame', () => {
  it('runs on the default encoder when nothing refuses', async () => {
    const read = await runInPage('none');
    expect(read.outcome).toBe('written');
    expect(read.packetCount).toBe(FRAME_COUNT);
    expect(read.selection).toEqual({
      acceleration: 'no-preference',
      defaultEncoderFailure: null,
      softwareEncoderFailure: null,
    });
  });

  it('is written whole through the software encoder', async () => {
    const read = await runInPage('default-refuses');
    expect(read.outcome).toBe('written');
    expect(read.packetCount).toBe(FRAME_COUNT);
    expect(read.selection?.acceleration).toBe('prefer-software');
    expect(read.selection?.defaultEncoderFailure).toContain('Unexpected frame format');
    expect(read.selection?.softwareEncoderFailure).toBeNull();
  });

  it('keeps the default and fails as before when software refuses too', async () => {
    const read = await runInPage('every-encoder-refuses');
    expect(read.outcome).toBe('failed');
    expect(read.failure).toContain('Unexpected frame format');
    expect(read.selection?.acceleration).toBe('no-preference');
    expect(read.selection?.softwareEncoderFailure).toContain('Unexpected frame format');
  });

  it('keeps the default and fails as before when the browser turns software down', async () => {
    const read = await runInPage('software-unsupported');
    expect(read.outcome).toBe('failed');
    expect(read.failure).toContain('Unexpected frame format');
    expect(read.selection?.acceleration).toBe('no-preference');
    expect(read.selection?.softwareEncoderFailure).toContain('not supported');
  });
});

async function runInPage(fault: EncoderFault): Promise<RunRead> {
  const page = await browser.newPage();
  try {
    // WebCodecs needs a secure context, which `about:blank` is not.
    await page.route('**/*', (route) => route.fulfill({
      contentType: 'text/html',
      body: '<title>refused first frame</title>',
    }));
    await page.goto('http://localhost/refused-first-frame');
    await page.addScriptTag({ content: bundle });
    return await page.evaluate(transcodeWithFault, { fault, size: SIZE, fps: FPS, frameCount: FRAME_COUNT });
  } finally {
    await page.close();
  }
}

interface PageRequest {
  fault: EncoderFault;
  size: { width: number; height: number };
  fps: number;
  frameCount: number;
}

/**
 * Encodes a source with the browser's own encoder, installs the fault,
 * transcodes the source with a painter that draws every source frame,
 * and counts the video packets of whatever was written.
 */
async function transcodeWithFault(request: PageRequest): Promise<RunRead> {
  /* eslint-disable @typescript-eslint/no-explicit-any */
  const fixture = (window as any).fixture;
  const { width, height } = request.size;

  const sourceCanvas = new OffscreenCanvas(width, height);
  const sourceContext = sourceCanvas.getContext('2d')!;
  const sourceTarget = new fixture.BufferTarget();
  const sourceOutput = new fixture.Output({ format: new fixture.Mp4OutputFormat(), target: sourceTarget });
  const canvasSource = new fixture.CanvasSource(sourceCanvas, { codec: 'avc', bitrate: 1_000_000 });
  sourceOutput.addVideoTrack(canvasSource);
  await sourceOutput.start();
  for (let index = 0; index < request.frameCount; index++) {
    sourceContext.fillStyle = `rgb(${index * 15}, 80, 160)`;
    sourceContext.fillRect(0, 0, width, height);
    await canvasSource.add(index / request.fps, 1 / request.fps);
  }
  await sourceOutput.finalize();

  if (request.fault !== 'none') {
    const fault = request.fault;
    const RealVideoEncoder = VideoEncoder;
    class FaultyVideoEncoder extends RealVideoEncoder {
      private readonly reportError: (error: DOMException) => void;
      private software = false;

      constructor(init: VideoEncoderInit) {
        super(init);
        this.reportError = init.error;
      }

      static override async isConfigSupported(config: VideoEncoderConfig): Promise<VideoEncoderSupport> {
        if (fault === 'software-unsupported' && config.hardwareAcceleration === 'prefer-software') {
          return { supported: false, config };
        }
        return RealVideoEncoder.isConfigSupported(config);
      }

      override configure(config: VideoEncoderConfig): void {
        this.software = config.hardwareAcceleration === 'prefer-software';
        super.configure(config);
      }

      override encode(frame: VideoFrame, options?: VideoEncoderEncodeOptions): void {
        if (this.software && fault !== 'every-encoder-refuses') {
          super.encode(frame, options);
          return;
        }
        // What the refusing encoder does: closes, then reports.
        super.close();
        this.reportError(new DOMException('Encoding error. (Unexpected frame format.)', 'OperationError'));
      }
    }
    (globalThis as any).VideoEncoder = FaultyVideoEncoder;
  }

  let selection: RunRead['selection'] = null;
  const coordinator = new fixture.MediaBunnyTranscodeCoordinator({
    videoFrameDecoderFactory: new fixture.DefaultVideoFrameDecoderFactory(),
    videoTrackEncoderFactory: new fixture.MediaBunnyCanvasVideoTrackEncoderFactory(),
    videoEncoderAccelerationPolicy: new fixture.ProbingVideoEncoderAccelerationPolicy(),
    audioTrackBridgeFactory: new fixture.DefaultAudioTrackBridgeFactory(),
    outputTargetBuilder: new fixture.MediaBunnyOutputTargetBuilder(),
  });
  let paintWidth = 0;
  let paintHeight = 0;
  const painter = {
    begin: async (w: number, h: number) => { paintWidth = w; paintHeight = h; },
    lookAhead: () => 1,
    paint: async (requests: ReadonlyArray<any>) => requests.map(({ frame }) => (context: OffscreenCanvasRenderingContext2D) => {
      frame.draw(context, 0, 0, paintWidth, paintHeight);
    }),
    end: () => {},
  };

  let blob: Blob;
  try {
    const result = await coordinator.execute({
      source: new File([sourceTarget.buffer], 'source.mp4', { type: 'video/mp4' }),
      codecPolicy: new fixture.DefaultCodecPolicy(),
      painter,
      outputFormat: 'mp4',
      onVideoEncoderSelected: (chosen: RunRead['selection']) => { selection = chosen; },
    });
    blob = result.blob;
  } catch (error) {
    return { outcome: 'failed', failure: `${(error as Error).name}: ${(error as Error).message}`, selection, packetCount: null };
  }

  const input = new fixture.Input({ source: new fixture.BlobSource(blob), formats: fixture.ALL_FORMATS });
  const track = await input.getPrimaryVideoTrack();
  const stats = await track.computePacketStats();
  return { outcome: 'written', failure: null, selection, packetCount: stats.packetCount };
  /* eslint-enable @typescript-eslint/no-explicit-any */
}

function fixtureModulePlugin(): Plugin {
  const resolved = `\0${FIXTURE_ID}`;
  return {
    name: 'refused-first-frame-fixture',
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

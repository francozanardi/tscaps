import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { resolve } from 'node:path';
import { chromium, type Browser, type Page } from '@playwright/test';
import { build, type Plugin } from 'vite';

/**
 * A still frame is the frame the render writes at the same moment.
 *
 * The comparison is relational: one job is rendered to a file, with
 * every painted frame read off the encoder's own canvas as it is handed
 * over, and painted again as stills, asked for out of order. Each still
 * must be that frame, pixel for pixel. The job carries what a still
 * could get wrong on its own: captions that change between moments, a
 * skipped range (so output time is not source time), and footage placed
 * in output time over the source.
 *
 * The order matters as much as the pixels. A caption source that walks
 * forward through time answers an earlier moment with the caption of a
 * later one, or with none, so the stills are asked late first.
 */

const FIXTURE_ID = 'virtual:still-frame-fixture';
const FIXTURE_SOURCE = `
  export { MediaBunnyStillFrameRenderer } from '@modules/video/mediabunny/MediaBunnyStillFrameRenderer';
  export { MediaBunnyVideoRenderer } from '@modules/video/mediabunny/MediaBunnyVideoRenderer';
  export { MediaBunnyTranscodeCoordinator } from '@modules/video/mediabunny/MediaBunnyTranscodeCoordinator';
  export { RenderJobFramePainterFactory } from '@modules/video/mediabunny/painter/RenderJobFramePainterFactory';
  export { BrowserSubtitleLayerSourceFactory } from '@modules/video/mediabunny/caption/BrowserSubtitleLayerSourceFactory';
  export { BrowserRandomAccessSubtitleLayerSourceFactory } from '@modules/video/mediabunny/caption/BrowserRandomAccessSubtitleLayerSourceFactory';
  export { CaptionLayerDemand } from '@modules/rendering/CaptionLayerDemand';
  export { SegmentSubtreeDecomposer } from '@modules/rendering/subtitle/SegmentSubtreeDecomposer';
  export { BrowserOverlayFrameRenderer } from '@modules/rendering/BrowserOverlayFrameRenderer';
  export { SpriteSheetSizeProbe } from '@modules/rendering/subtitle/SpriteSheetSizeProbe';
  export { ImageDecodeSpriteSheetRasterProbe } from '@modules/rendering/subtitle/ImageDecodeSpriteSheetRasterProbe';
  export { LayeredFrameCompositor } from '@modules/video/mediabunny/frame/LayeredFrameCompositor';
  export { MediaBunnyFootageOpener } from '@modules/video/mediabunny/footage/MediaBunnyFootageOpener';
  export { CanvasFootageCompositor } from '@modules/video/CanvasFootageCompositor';
  export { CanvasFilterFootageGrader } from '@modules/video/grade/CanvasFilterFootageGrader';
  export { FootageGradeMath } from '@modules/video/grade/FootageGradeMath';
  export { CssFootageLayerResolverFactory } from '@modules/video/stage/CssFootageLayerResolverFactory';
  export { ComputedFootageLayerStateReader } from '@modules/video/stage/ComputedFootageLayerStateReader';
  export { FootageStageBaselineCss } from '@modules/video/stage/FootageStageBaselineCss';
  export { CssFootageLayerClockFactory } from '@modules/video/stage/CssFootageLayerClockFactory';
  export { CssFootageClockUseInspector } from '@modules/video/stage/CssFootageClockUseInspector';
  export { DefaultVideoFrameDecoderFactory } from '@modules/video/mediabunny/frame/DefaultVideoFrameDecoderFactory';
  export { MediaBunnyCanvasVideoTrackEncoderFactory } from '@modules/video/mediabunny/encoder/MediaBunnyCanvasVideoTrackEncoderFactory';
  export { ProbingVideoEncoderAccelerationPolicy } from '@modules/video/mediabunny/encoder/ProbingVideoEncoderAccelerationPolicy';
  export { DefaultAudioTrackBridgeFactory } from '@modules/video/mediabunny/audio/DefaultAudioTrackBridgeFactory';
  export { MediaBunnyOutputTargetBuilder } from '@modules/video/mediabunny/output/MediaBunnyOutputTargetBuilder';
  export { DefaultCodecPolicy } from '@modules/video/mediabunny/codec/DefaultCodecPolicy';
  export { GraphemeWordSplitter } from '@modules/splitting/GraphemeWordSplitter';
  export { Document } from '@modules/document/Document';
  export { Section } from '@modules/document/Section';
  export { Segment } from '@modules/document/Segment';
  export { Line } from '@modules/document/Line';
  export { Word } from '@modules/document/Word';
  export { TimeFragment } from '@modules/document/TimeFragment';
  export { BufferTarget, CanvasSource, Mp4OutputFormat, Output } from 'mediabunny';
`;

const WIDTH = 180;
const HEIGHT = 320;
const FPS = 30;
const FRAME_COUNT = 45;
/** Source seconds the output leaves out. */
const SKIPPED = { startSec: 0.3, endSec: 0.5 };
/** Output seconds over which the footage layer shows. */
const FOOTAGE_OUTPUT = { startSec: 0.6, endSec: 0.9 };

/** What one moment came out as, compared with the exported frame at the same output time. */
interface StillVerdict {
  readonly askedSec: number;
  readonly sourceSec: number;
  readonly outputSec: number;
  /** Whether the export painted a frame at that output time at all. */
  readonly exported: boolean;
  /** Pixels whose colour differs from the exported frame's in any channel. */
  readonly differing: number;
  /** Red caption pixels in the still. */
  readonly captionPixels: number;
  /** Green footage pixels in the still. */
  readonly footagePixels: number;
}

interface Comparison {
  readonly width: number;
  readonly height: number;
  readonly verdicts: ReadonlyArray<StillVerdict>;
  /** Pixels in which the exported frames at the first two moments asked differ, so their stills could not pass for each other. */
  readonly firstTwoExportsDiffer: number;
}

let browser: Browser;
let bundle: string;

beforeAll(async () => {
  browser = await chromium.launch();
  bundle = await bundleForThePage();
}, 180_000);

afterAll(async () => { await browser.close(); });

describe('a still frame', () => {
  it('is the frame the render writes at the same moment, asked in any order', async () => {
    // Late first, then early: the second caption, then the first.
    const asked = [1.2, 0.1, 0.9, 0.65, 0.15, 1.35];
    const { verdicts, width, height, firstTwoExportsDiffer } = await compareStills(asked);

    expect(`${width}x${height}`).toBe(`${WIDTH}x${HEIGHT}`);
    expect(firstTwoExportsDiffer).toBeGreaterThan(0);
    for (const verdict of verdicts) {
      expect(verdict.exported, `a frame exported at ${verdict.outputSec}`).toBe(true);
      expect(verdict.differing, `pixels differing at ${verdict.askedSec} s`).toBe(0);
    }
  });

  it('still draws an earlier caption after a later one was asked', async () => {
    const { verdicts } = await compareStills([1.2, 0.1]);

    expect(verdicts[1]!.captionPixels).toBeGreaterThan(0);
    expect(verdicts[1]!.differing).toBe(0);
  });

  it('shows the first frame after a skipped range for a moment inside it, and the footage of that output moment', async () => {
    const { verdicts } = await compareStills([0.4, 0.9]);

    // 0.4 s is skipped; the output resumes at 0.5 s, its 0.3 s.
    expect(verdicts[0]!.sourceSec).toBeCloseTo(SKIPPED.endSec, 5);
    expect(verdicts[0]!.outputSec).toBeCloseTo(SKIPPED.startSec, 5);
    expect(verdicts[0]!.differing).toBe(0);
    // 0.9 s of source is 0.7 s of output, inside the footage's stretch.
    expect(verdicts[1]!.footagePixels).toBeGreaterThan(0);
    expect(verdicts[1]!.differing).toBe(0);
  });
});

async function compareStills(asked: number[]): Promise<Comparison> {
  const page = await browser.newPage();
  try {
    // WebCodecs needs a secure context, which `about:blank` is not.
    await page.route('**/*', (route) => route.fulfill({ contentType: 'text/html', body: '<title>still frames</title>' }));
    await page.goto('http://localhost/still-frames');
    await page.addScriptTag({ content: bundle });
    return await runInPage(page, asked);
  } finally {
    await page.close();
  }
}

function runInPage(page: Page, asked: number[]): Promise<Comparison> {
  return page.evaluate(async ({ asked, width, height, fps, frameCount, skipped, footageOutput }) => {
    type Ctor = new (...args: unknown[]) => unknown;
    const f = (window as unknown as { fixture: Record<string, Ctor> }).fixture;
    const make = <T,>(name: string, ...args: unknown[]): T => new (f[name] as unknown as new (...a: unknown[]) => T)(...args);

    // A source whose every frame differs: a colour stepping per frame, and a bar moving across.
    const sourceCanvas = new OffscreenCanvas(width, height);
    const sourceContext = sourceCanvas.getContext('2d')!;
    const target = make<{ buffer: ArrayBuffer | null }>('BufferTarget');
    const output = make<{ addVideoTrack: (s: unknown) => void; start: () => Promise<void>; finalize: () => Promise<void> }>(
      'Output', { format: make('Mp4OutputFormat'), target },
    );
    const canvasSource = make<{ add: (t: number, d: number) => Promise<void> }>('CanvasSource', sourceCanvas, { codec: 'avc', bitrate: 4_000_000 });
    output.addVideoTrack(canvasSource);
    await output.start();
    for (let index = 0; index < frameCount; index++) {
      sourceContext.fillStyle = `rgb(${(index * 5) % 256}, ${255 - ((index * 5) % 256)}, 140)`;
      sourceContext.fillRect(0, 0, width, height);
      sourceContext.fillStyle = '#202020';
      sourceContext.fillRect((index * 4) % width, 0, 12, height);
      await canvasSource.add(index / fps, 1 / fps);
    }
    await output.finalize();
    const video = new File([target.buffer!], 'source.mp4', { type: 'video/mp4' });

    const word = (id: string, start: number, end: number) => make('Word', { id, text: id, time: make('TimeFragment', start, end) });
    const document = make('Document', {
      sections: [make('Section', {
        id: 'section', kind: 'main',
        segments: [
          make('Segment', { id: 's1', lines: [make('Line', { id: 'l1', words: [word('a1', 0, 0.6)] })] }),
          make('Segment', { id: 's2', lines: [make('Line', { id: 'l2', words: [word('b1', 0.7, 1.4), word('b2', 0.9, 1.4)] })] }),
        ],
      })],
    });
    const styles = {
      main: {
        css: '.line { display: flex; column-gap: 8px; } .word { display: inline-block; width: 40px; height: 24px; color: transparent; background: rgb(255, 0, 0); }',
        inlineStyles: {},
        alignment: { verticalAlign: 'bottom', verticalOffset: 0.1, horizontalAlign: 'center', horizontalOffset: 0 },
        rendering: { splitWordsIntoLetters: false, videoFrame: { required: false, jpegQuality: 0.8 }, padding: null, textDirection: 'ltr' },
      },
    };
    // Green over the top left quarter, wherever its stretch of output runs.
    const provider = {
      open: async () => ({
        width: 10,
        height: 10,
        pictureAt: async () => {
          const canvas = new OffscreenCanvas(10, 10);
          const context = canvas.getContext('2d')!;
          context.fillStyle = '#00ff00';
          context.fillRect(0, 0, 10, 10);
          return canvas.transferToImageBitmap();
        },
        frameOf: (sourceSec: number) => sourceSec,
        close: () => undefined,
      }),
    };
    const footage = {
      layers: [{
        id: 'green', source: { kind: 'provided', provider },
        outputStartSec: footageOutput.startSec, outputEndSec: footageOutput.endSec, sourceStartSec: 0, sourcePassSec: Infinity,
      }],
      style: { css: '[data-tscaps-el="green"] { left: 0; top: 0; width: 50%; height: 50%; }', frameWidth: width, frameHeight: height },
    };
    const job = { video, document, styles, footage, skipRanges: [skipped] };

    const embedder = { embed: (text: string) => Promise.resolve(text) };
    const words = make('GraphemeWordSplitter');
    const painterFactory = (layerSources: unknown) => make('RenderJobFramePainterFactory',
      layerSources,
      make('CaptionLayerDemand', make('SegmentSubtreeDecomposer')),
      make('BrowserOverlayFrameRenderer'),
      make('LayeredFrameCompositor'),
      make('MediaBunnyFootageOpener', { open: () => Promise.reject(new Error('No GIF here')) }),
      make('CanvasFootageCompositor', make('CanvasFilterFootageGrader', make('FootageGradeMath'))),
      make(
        'CssFootageLayerResolverFactory',
        make('ComputedFootageLayerStateReader'),
        make('FootageStageBaselineCss'),
        make('CssFootageLayerClockFactory', make('CssFootageClockUseInspector')),
      ),
    );

    // The render, with every painted frame read off the encoder's own canvas, by output time.
    const exported = new Map<number, Uint8ClampedArray>();
    const key = (seconds: number) => Math.round(seconds * 1e6);
    const encoders = make<{ create: (request: unknown) => {
      width: number; height: number;
      attachTo: (o: unknown) => void;
      encode: (t: number, d: number, paint: (c: OffscreenCanvasRenderingContext2D) => void) => Promise<void>;
      encodeAsDecoded: (...args: unknown[]) => Promise<void>;
    } }>('MediaBunnyCanvasVideoTrackEncoderFactory');
    const recordingEncoders = {
      create: (request: unknown) => {
        const encoder = encoders.create(request);
        return {
          width: encoder.width,
          height: encoder.height,
          attachTo: (o: unknown) => encoder.attachTo(o),
          encodeAsDecoded: (...args: unknown[]) => encoder.encodeAsDecoded(...args),
          encode: (t: number, d: number, paint: (c: OffscreenCanvasRenderingContext2D) => void) => encoder.encode(t, d, (context) => {
            paint(context);
            exported.set(key(t), context.getImageData(0, 0, encoder.width, encoder.height).data);
          }),
        };
      },
    };
    const renderer = make<{ render: (job: unknown) => Promise<unknown> }>('MediaBunnyVideoRenderer', {
      coordinator: make('MediaBunnyTranscodeCoordinator', {
        videoFrameDecoderFactory: make('DefaultVideoFrameDecoderFactory'),
        videoTrackEncoderFactory: recordingEncoders,
        videoEncoderAccelerationPolicy: make('ProbingVideoEncoderAccelerationPolicy'),
        audioTrackBridgeFactory: make('DefaultAudioTrackBridgeFactory'),
        outputTargetBuilder: make('MediaBunnyOutputTargetBuilder'),
      }),
      codecPolicy: make('DefaultCodecPolicy'),
      painterFactory: painterFactory(make('BrowserSubtitleLayerSourceFactory', embedder, words,
        make('SpriteSheetSizeProbe', make('ImageDecodeSpriteSheetRasterProbe')))),
    });
    await renderer.render(job);

    const stills = make<{ open: (job: unknown) => Promise<{
      width: number; height: number;
      frameAt: (t: number) => Promise<{ bitmap: ImageBitmap; sourceSec: number; outputSec: number }>;
      close: () => Promise<void>;
    }> }>('MediaBunnyStillFrameRenderer', {
      painterFactory: painterFactory(make('BrowserRandomAccessSubtitleLayerSourceFactory', embedder, words,
        make('SpriteSheetSizeProbe', make('ImageDecodeSpriteSheetRasterProbe'), null, 0))),
    });
    const session = await stills.open(job);
    const verdicts = [];
    const firstExports: Uint8ClampedArray[] = [];
    for (const askedSec of asked) {
      const still = await session.frameAt(askedSec);
      const canvas = new OffscreenCanvas(session.width, session.height);
      const context = canvas.getContext('2d')!;
      context.drawImage(still.bitmap, 0, 0);
      still.bitmap.close();
      const pixels = context.getImageData(0, 0, session.width, session.height).data;
      const reference = exported.get(key(still.outputSec));
      if (reference && firstExports.length < 2) firstExports.push(reference);
      let differing = 0;
      let captionPixels = 0;
      let footagePixels = 0;
      for (let i = 0; i < pixels.length; i += 4) {
        if (reference && (pixels[i] !== reference[i] || pixels[i + 1] !== reference[i + 1] || pixels[i + 2] !== reference[i + 2])) differing++;
        if (pixels[i]! > 240 && pixels[i + 1]! < 20 && pixels[i + 2]! < 20) captionPixels++;
        if (pixels[i]! < 20 && pixels[i + 1]! > 240 && pixels[i + 2]! < 20) footagePixels++;
      }
      verdicts.push({ askedSec, sourceSec: still.sourceSec, outputSec: still.outputSec, exported: reference !== undefined, differing, captionPixels, footagePixels });
    }
    await session.close();
    let firstTwoExportsDiffer = 0;
    if (firstExports.length === 2) {
      for (let i = 0; i < firstExports[0]!.length; i++) if (firstExports[0]![i] !== firstExports[1]![i]) firstTwoExportsDiffer++;
    }
    return { width: session.width, height: session.height, verdicts, firstTwoExportsDiffer };
  }, {
    asked, width: WIDTH, height: HEIGHT, fps: FPS, frameCount: FRAME_COUNT, skipped: SKIPPED, footageOutput: FOOTAGE_OUTPUT,
  });
}

function fixtureModulePlugin(): Plugin {
  const resolved = `\0${FIXTURE_ID}`;
  return {
    name: 'still-frame-fixture',
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
        // An app build tree-shakes an entry's exports away, and this entry is nothing but exports.
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

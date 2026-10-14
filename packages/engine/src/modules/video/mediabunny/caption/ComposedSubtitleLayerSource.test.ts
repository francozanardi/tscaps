import { describe, expect, it } from 'vitest';
import { Document } from '@modules/document/Document';
import type { SubtitleFrame, SubtitleStyle } from '@modules/rendering/SubtitleFrameRenderer';
import type { DecodedVideoFrame } from '@modules/video/mediabunny/frame/VideoFrameDecoder';
import type {
  SubtitleLayerRequest,
  SubtitleLayerSource,
} from '@modules/video/mediabunny/caption/SubtitleLayerSource';
import { ComposedSubtitleLayerSource } from '@modules/video/mediabunny/caption/ComposedSubtitleLayerSource';
import { SubtitleStyleFrameDemand } from '@modules/rendering/SubtitleStyleFrameDemand';
import { ElementRenderOverrides } from '@modules/rendering/types/ElementRenderOverrides';
import { CaptionBlendMode } from '@modules/rendering/types/CaptionBlendMode';

/**
 * Which moment each half of a composed caption is painted for.
 *
 * Caption ticks are capped at 30/s, so a faster video hands several
 * frames to the same tick. Collapsing them is right for the text — it
 * is what lets one tile serve them all — and wrong for a style that
 * bakes the pixels under the caption into its picture, which owes every
 * frame the pixels that frame actually shows. Give both halves the tick
 * and the backdrop sits on a moment the video has already left, in a
 * rectangle registered pixel-for-pixel with the frame around it.
 *
 * The assertions paint the frame the composite hands back and read what
 * landed on the canvas, so they survive any rearrangement of who asks
 * whom for what.
 */

// Mirrors the cap the painter applies when it derives the interval.
const CAPTION_FPS_CAP = 30;

const NO_VIDEO_FRAME = null as unknown as DecodedVideoFrame;
const NO_CONTEXT = null as unknown as CanvasRenderingContext2D;

type LayerName = 'text' | 'backdrop';

interface PaintedLayer {
  readonly layer: LayerName;
  readonly time: number;
}

/**
 * Sub-source whose layers report the time they were asked for once
 * something paints them.
 */
class TimeReportingLayerSource implements SubtitleLayerSource {

  constructor(
    private readonly layer: LayerName,
    private readonly reach: number,
    private readonly painted: PaintedLayer[],
  ) {}

  async open(): Promise<void> {}

  lookAhead(): number {
    return this.reach;
  }

  async framesFor(requests: ReadonlyArray<SubtitleLayerRequest>): Promise<Array<SubtitleFrame | null>> {
    return requests.map((request) => ({
      draw: () => this.painted.push({ layer: this.layer, time: request.time }),
    }));
  }

  close(): void {}
}

function styleReadingVideoFrame(required: boolean): SubtitleStyle {
  return { rendering: { videoFrame: { required } } } as unknown as SubtitleStyle;
}

function styleBlendingAWord(): SubtitleStyle {
  return {
    rendering: { videoFrame: { required: false } },
    subtreeOverrides: ElementRenderOverrides.fromEntries([
      ['w1', { blendMode: CaptionBlendMode.DIFFERENCE }],
    ]),
  } as unknown as SubtitleStyle;
}

const TEXT_ONLY = { plain: styleReadingVideoFrame(false) };
const BACKDROP_ONLY = { lit: styleReadingVideoFrame(true) };
const BOTH = { ...TEXT_ONLY, ...BACKDROP_ONLY };

const TEXT_REACH = 1;
const BACKDROP_REACH = 21;

interface OpenComposite {
  readonly source: ComposedSubtitleLayerSource;
  readonly painted: PaintedLayer[];
}

async function openComposite(
  styles: Record<string, SubtitleStyle>,
  captionInterval: number,
): Promise<OpenComposite> {
  const painted: PaintedLayer[] = [];
  const source = new ComposedSubtitleLayerSource(
    new TimeReportingLayerSource('text', TEXT_REACH, painted),
    new TimeReportingLayerSource('backdrop', BACKDROP_REACH, painted),
    new SubtitleStyleFrameDemand(),
  );
  await source.open(new Document({ sections: [] }), styles, 720, 1280, captionInterval);
  return { source, painted };
}

/** Every layer that ended up on the canvas for the first `frameCount` frames of a `sourceFps` video. */
async function paintRun(
  sourceFps: number,
  frameCount: number,
  styles: Record<string, SubtitleStyle> = BOTH,
): Promise<PaintedLayer[]> {
  const { source, painted } = await openComposite(styles, 1 / Math.min(sourceFps, CAPTION_FPS_CAP));
  const frames = await source.framesFor(
    Array.from({ length: frameCount }, (_, i) => ({ time: i / sourceFps, videoFrame: NO_VIDEO_FRAME })),
  );
  for (const frame of frames) frame?.draw(NO_CONTEXT, 0, 0, 0, 0);
  return painted;
}

/** What `layer` was painted for, counted in whole source frames. */
function framesPaintedBy(
  painted: ReadonlyArray<PaintedLayer>,
  layer: LayerName,
  sourceFps: number,
): number[] {
  return painted.filter((entry) => entry.layer === layer).map((entry) => Math.round(entry.time * sourceFps));
}

const SIXTY_FPS = 60;
const THIRTY_FPS = 30;
const SEVEN_FRAMES = 7;

describe('a video whose frames outrun the caption tick', () => {
  it('paints the backdrop for each frame’s own moment, because the pixels under it moved', async () => {
    const painted = await paintRun(SIXTY_FPS, SEVEN_FRAMES);
    expect(framesPaintedBy(painted, 'backdrop', SIXTY_FPS)).toEqual([0, 1, 2, 3, 4, 5, 6]);
  });

  it('still collapses the text onto ticks, which is what lets one tile serve several frames', async () => {
    const painted = await paintRun(SIXTY_FPS, SEVEN_FRAMES);
    expect(framesPaintedBy(painted, 'text', SIXTY_FPS)).toEqual([0, 2, 2, 4, 4, 6, 6]);
  });
});

describe('a video already at the caption tick rate', () => {
  it('paints both halves for the same moments, so nothing on this path moves', async () => {
    const painted = await paintRun(THIRTY_FPS, SEVEN_FRAMES);
    const everyFrame = [0, 1, 2, 3, 4, 5, 6];
    expect(framesPaintedBy(painted, 'backdrop', THIRTY_FPS)).toEqual(everyFrame);
    expect(framesPaintedBy(painted, 'text', THIRTY_FPS)).toEqual(everyFrame);
  });
});

describe('what the composite hands back', () => {
  it('paints the backdrop over the text', async () => {
    const painted = await paintRun(SIXTY_FPS, 1);
    expect(painted.map((entry) => entry.layer)).toEqual(['text', 'backdrop']);
  });

  // A blend is applied when its layer is composited, so its raster holds
  // nothing of the frame and has no reason to be painted frame by frame.
  it('routes a style that blends an element with the ones that do not read the frame', async () => {
    const painted = await paintRun(SIXTY_FPS, 2, { blending: styleBlendingAWord() });
    expect(painted.map((entry) => entry.layer)).toEqual(['text', 'text']);
  });

  it('paints the one open half when the other has no Section', async () => {
    expect(await paintRun(SIXTY_FPS, 1, BACKDROP_ONLY)).toEqual([{ layer: 'backdrop', time: 0 }]);
    expect(await paintRun(SIXTY_FPS, 1, TEXT_ONLY)).toEqual([{ layer: 'text', time: 0 }]);
  });
});

describe('how far the composite asks the caller to look', () => {
  it('takes the hungrier of the two halves', async () => {
    const { source } = await openComposite(BOTH, 1 / CAPTION_FPS_CAP);
    expect(source.lookAhead()).toBe(BACKDROP_REACH);
  });

  it('drops back to the batched half alone when no Section reads the frame', async () => {
    const { source } = await openComposite(TEXT_ONLY, 1 / CAPTION_FPS_CAP);
    expect(source.lookAhead()).toBe(TEXT_REACH);
  });
});

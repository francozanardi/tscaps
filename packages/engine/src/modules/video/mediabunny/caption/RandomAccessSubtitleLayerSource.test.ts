import { describe, expect, it } from 'vitest';
import { Document } from '@modules/document/Document';
import type { SubtitleFrame, SubtitleFrameRenderer, SubtitleStyle } from '@modules/rendering/SubtitleFrameRenderer';
import type { DecodedVideoFrame } from '@modules/video/mediabunny/frame/VideoFrameDecoder';
import type { SubtitleLayerRequest, SubtitleLayerSource } from '@modules/video/mediabunny/caption/SubtitleLayerSource';
import { ComposedSubtitleLayerSource } from '@modules/video/mediabunny/caption/ComposedSubtitleLayerSource';
import { RandomAccessSubtitleLayerSource } from '@modules/video/mediabunny/caption/RandomAccessSubtitleLayerSource';
import { SubtitleStyleFrameDemand } from '@modules/rendering/SubtitleStyleFrameDemand';

/**
 * Which moment each caption is painted for, when moments are asked out
 * of order.
 *
 * The promise is relational: a frame asked on its own lands on the
 * caption tick it lands on in a render that walks through every frame
 * in order. A video faster than the tick rate is where that can go
 * wrong, since several frames share one tick there, so the run is at
 * 60 fps against ticks capped at 30 per second.
 *
 * Both sources paint frames that report the moment they were painted
 * for, and the assertions read what landed, not who asked whom.
 */

const NO_VIDEO_FRAME = null as unknown as DecodedVideoFrame;
const NO_CONTEXT = null as unknown as CanvasRenderingContext2D;

const SIXTY_FPS = 60;
const FRAME_COUNT = 13;
const CAPTION_INTERVAL = 1 / 30;

interface Painted {
  readonly half: 'text' | 'backdrop';
  readonly time: number;
}

function reportingFrame(painted: Painted[], half: Painted['half'], time: number): SubtitleFrame {
  return { draw: () => painted.push({ half, time }) };
}

/** A renderer whose every frame reports the timestamp it was asked for; it answers one timestamp per call, as a full sheet would. */
class OneTileRenderer implements SubtitleFrameRenderer {
  constructor(private readonly painted: Painted[]) {}

  async open(): Promise<void> {}

  async getMaxTilesPerBatch(): Promise<number> {
    return 1;
  }

  async getFrames(timestamps: ReadonlyArray<number>): Promise<Array<SubtitleFrame | null>> {
    return timestamps.slice(0, 1).map((time) => reportingFrame(this.painted, 'text', time));
  }

  close(): void {}
}

class ReportingLayerSource implements SubtitleLayerSource {
  constructor(private readonly half: Painted['half'], private readonly painted: Painted[]) {}

  async open(): Promise<void> {}

  lookAhead(): number {
    return 1;
  }

  async framesFor(requests: ReadonlyArray<SubtitleLayerRequest>): Promise<Array<SubtitleFrame | null>> {
    return requests.map((request) => reportingFrame(this.painted, this.half, request.time));
  }

  close(): void {}
}

function style(readsVideoFrame: boolean): SubtitleStyle {
  return { rendering: { videoFrame: { required: readsVideoFrame } } } as unknown as SubtitleStyle;
}

const BOTH_HALVES = { plain: style(false), lit: style(true) };

function frameTimes(): number[] {
  return Array.from({ length: FRAME_COUNT }, (_, i) => i / SIXTY_FPS);
}

/** The moment each half was painted for at each frame, frame by frame in the order given. */
async function paintEach(source: SubtitleLayerSource, painted: Painted[], times: ReadonlyArray<number>): Promise<Map<number, Painted[]>> {
  await source.open(new Document({ sections: [] }), BOTH_HALVES, 720, 1280, CAPTION_INTERVAL);
  const byFrame = new Map<number, Painted[]>();
  for (const time of times) {
    painted.length = 0;
    const [frame] = await source.framesFor([{ time, videoFrame: NO_VIDEO_FRAME }]);
    frame?.draw(NO_CONTEXT, 0, 0, 0, 0);
    byFrame.set(time, [...painted]);
  }
  return byFrame;
}

describe('a caption source asked for moments in any order', () => {
  it('paints each frame for the moments a render in order paints it for', async () => {
    const inOrderPainted: Painted[] = [];
    const inOrder = await paintEach(
      new ComposedSubtitleLayerSource(
        new ReportingLayerSource('text', inOrderPainted),
        new ReportingLayerSource('backdrop', inOrderPainted),
        new SubtitleStyleFrameDemand(),
      ),
      inOrderPainted,
      frameTimes(),
    );
    const shuffled = [...frameTimes()].reverse();
    const anyOrderPainted: Painted[] = [];
    const anyOrder = await paintEach(
      new RandomAccessSubtitleLayerSource(
        new OneTileRenderer(anyOrderPainted),
        new ReportingLayerSource('backdrop', anyOrderPainted),
        new SubtitleStyleFrameDemand(),
      ),
      anyOrderPainted,
      shuffled,
    );

    for (const time of frameTimes()) {
      expect(anyOrder.get(time), `frame at ${time}`).toEqual(inOrder.get(time));
    }
  });

  it('answers a run longer than the renderer reaches in one call', async () => {
    const painted: Painted[] = [];
    const source = new RandomAccessSubtitleLayerSource(
      new OneTileRenderer(painted),
      new ReportingLayerSource('backdrop', painted),
      new SubtitleStyleFrameDemand(),
    );
    await source.open(new Document({ sections: [] }), { plain: style(false) }, 720, 1280, CAPTION_INTERVAL);

    const frames = await source.framesFor([0.5, 0.1, 0.3].map((time) => ({ time, videoFrame: NO_VIDEO_FRAME })));
    for (const frame of frames) frame?.draw(NO_CONTEXT, 0, 0, 0, 0);

    expect(painted.map((entry) => Math.round(entry.time / CAPTION_INTERVAL))).toEqual([15, 3, 9]);
  });
});

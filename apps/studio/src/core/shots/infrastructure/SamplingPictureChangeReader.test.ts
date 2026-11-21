import { describe, expect, it } from 'vitest';
import { EditorStore } from '@core/editor/store/EditorStore';
import type { FrameThumbnailReader } from '@core/person-segmentation/services/FrameThumbnailReader';
import type { PictureChangeReader } from '@core/shots/domain/PictureChangeReader';
import { SamplingPictureChangeReader } from '@core/shots/infrastructure/SamplingPictureChangeReader';
import type { SamplingStretch } from '@core/subject-tracking/domain/SamplingStretch';
import type { SampledFrame, VideoFrameSampler } from '@core/subject-tracking/domain/VideoFrameSampler';

/**
 * A 12 s video at 30 frames a second whose picture is dark until 5.1 s
 * and bright from that frame on, read in order: the change is placed on
 * the frame the picture changes at, found once for a video, and left to
 * the fallback where the video cannot be decoded.
 */

const FRAME_SEC = 1 / 30;
const CHANGE_FRAME = Math.round(5.1 / FRAME_SEC);
const DURATION_SEC = 12;

/** A frame's stand-in: only its brightness, which is all the thumbnails below read. */
interface TonedBitmap {
  readonly tone: number;
  close(): void;
}

/** The video above, decoded in order: a frame at each stretch's start and at its rate after it, on the frame grid. */
class ToneVideoSampler implements VideoFrameSampler {
  reads = 0;

  constructor(private readonly fails = false) {}

  async *sample(_video: Blob, stretches: ReadonlyArray<SamplingStretch>): AsyncGenerator<SampledFrame> {
    this.reads += 1;
    if (this.fails) throw new Error('The codec cannot be decoded');
    for (const stretch of stretches) {
      let last = -1;
      for (let wanted = stretch.startSec; wanted < stretch.endSec; wanted += 1 / stretch.framesPerSecond) {
        const frame = Math.floor(wanted / FRAME_SEC + 1e-6);
        if (frame === last) continue;
        last = frame;
        const bitmap: TonedBitmap = { tone: frame >= CHANGE_FRAME ? 230 : 20, close: () => undefined };
        yield { sourceSec: frame * FRAME_SEC, bitmap: bitmap as unknown as ImageBitmap };
      }
    }
  }
}

/** Thumbnails of the stand-in frames: four pixels of the frame's brightness. */
const THUMBNAILS = {
  pixelsOf: (bitmap: ImageBitmap) => new Uint8ClampedArray(16).fill((bitmap as unknown as TonedBitmap).tone),
} as unknown as FrameThumbnailReader;

function setUp(sampler: ToneVideoSampler, fallbackChanges: ReadonlyArray<number> = []) {
  const store = new EditorStore();
  store.patchVideo({ file: new File([new Uint8Array(1)], 'video.mp4'), duration: DURATION_SEC });
  const fallback: PictureChangeReader = { read: async () => fallbackChanges };
  return { store, reader: new SamplingPictureChangeReader(store, sampler, THUMBNAILS, fallback) };
}

describe('SamplingPictureChangeReader', () => {
  it('places a change on the frame the picture changes at', async () => {
    const { reader } = setUp(new ToneVideoSampler());

    const changes = await reader.read();

    expect(changes).toHaveLength(1);
    expect(changes[0]).toBeCloseTo(CHANGE_FRAME * FRAME_SEC, 6);
  });

  it('reads a video once, and again once another video is loaded', async () => {
    const sampler = new ToneVideoSampler();
    const { store, reader } = setUp(sampler);
    await reader.read();
    const readsForOne = sampler.reads;

    await reader.read();
    expect(sampler.reads).toBe(readsForOne);

    store.patchVideo({ file: new File([new Uint8Array(2)], 'other.mp4') });
    await reader.read();
    expect(sampler.reads).toBeGreaterThan(readsForOne);
  });

  it('leaves a video it cannot decode to the fallback', async () => {
    const { reader } = setUp(new ToneVideoSampler(true), [3, 7]);

    expect(await reader.read()).toEqual([3, 7]);
  });
});

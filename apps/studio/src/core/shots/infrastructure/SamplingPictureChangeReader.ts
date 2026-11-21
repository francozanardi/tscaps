import type { EditorStore } from '@core/editor/store/EditorStore';
import type { FrameThumbnailReader } from '@core/person-segmentation/services/FrameThumbnailReader';
import { PictureChangeDetector } from '@core/preview/services/PictureChangeDetector';
import type { PictureChangeReader } from '@core/shots/domain/PictureChangeReader';
import type { SamplingStretch } from '@core/subject-tracking/domain/SamplingStretch';
import type { VideoFrameSampler } from '@core/subject-tracking/domain/VideoFrameSampler';

// A gap is read this far past the look its change was found at, so that look's own frame is in it.
const AFTER_CHANGE_SEC = 0.005;

/**
 * Finds the source's picture changes by decoding the video in order,
 * once, rather than seeking to each moment looked at: a seek decodes
 * from the key frame before it every time, which on a machine that
 * decodes in software costs more than ten times as much.
 *
 * The whole video is looked at a few frames a second, which finds every
 * change but places it only within the gap between two looks; each one
 * is then placed on its frame by looking at every frame of that gap.
 * It reads the preview proxy where there is one, else the original.
 * What it finds is remembered for that video, so asking again while it
 * is loaded reads nothing and reports no progress. A video it cannot
 * decode this way (one with no file behind it, or a codec the browser
 * plays but does not hand out frame by frame) is left to `fallback`.
 */
export class SamplingPictureChangeReader implements PictureChangeReader {
  /** Looks per second over the whole video. */
  private static readonly COARSE_FPS = 6;
  /** Looks per second inside a gap a change was found in: more than any video has frames, so every frame of the gap is looked at. */
  private static readonly FINE_FPS = 240;
  /** The share of the search that the look at the whole video is; placing each change on its frame is the rest. */
  private static readonly COARSE_SHARE = 0.85;

  private remembered: { readonly video: Blob; readonly changes: ReadonlyArray<number> } | null = null;

  constructor(
    private readonly editorStore: EditorStore,
    private readonly sampler: VideoFrameSampler,
    private readonly thumbnails: FrameThumbnailReader,
    private readonly fallback: PictureChangeReader,
  ) {}

  async read(onProgress: (fraction: number) => void = () => undefined): Promise<ReadonlyArray<number>> {
    const { video } = this.editorStore.snapshot();
    const file = video.preview?.file ?? video.file;
    if (file === null) return this.fallback.read(onProgress);
    if (this.remembered?.video === file) return this.remembered.changes;
    let changes: number[];
    try {
      changes = await this.changesIn(file, video.duration, onProgress);
    } catch {
      // The video could not be decoded frame by frame; the fallback finds the same changes its own way, or fails with its own cause.
      return this.fallback.read(onProgress);
    }
    this.remembered = { video: file, changes };
    return changes;
  }

  private async changesIn(video: Blob, durationSec: number, onProgress: (fraction: number) => void): Promise<number[]> {
    const step = 1 / SamplingPictureChangeReader.COARSE_FPS;
    const coarseShare = SamplingPictureChangeReader.COARSE_SHARE;
    const whole = { startSec: 0, endSec: durationSec, framesPerSecond: SamplingPictureChangeReader.COARSE_FPS };
    const coarse = await this.changesAt(video, whole, (sourceSec) => onProgress(Math.min(1, sourceSec / durationSec) * coarseShare));
    const placed: number[] = [];
    for (const changeSec of coarse) {
      placed.push(await this.placed(video, changeSec, step));
      onProgress(coarseShare + (1 - coarseShare) * (placed.length / coarse.length));
    }
    return placed;
  }

  /** The first frame of the new picture in the gap of `step` that ends with the frame at `changeSec`; `changeSec` where none stands out. */
  private async placed(video: Blob, changeSec: number, step: number): Promise<number> {
    const gap = { startSec: Math.max(0, changeSec - step), endSec: changeSec + AFTER_CHANGE_SEC, framesPerSecond: SamplingPictureChangeReader.FINE_FPS };
    const found = await this.changesAt(video, gap, () => undefined);
    return found[0] ?? changeSec;
  }

  /** The changes among the frames of `stretch`; `onLooked` is told the time of each frame looked at. */
  private async changesAt(video: Blob, stretch: SamplingStretch, onLooked: (sourceSec: number) => void): Promise<number[]> {
    const detector = new PictureChangeDetector();
    for await (const frame of this.sampler.sample(video, [stretch], new AbortController().signal)) {
      try {
        detector.observe(frame.sourceSec, this.thumbnails.pixelsOf(frame.bitmap));
      } finally {
        frame.bitmap.close();
      }
      onLooked(frame.sourceSec);
    }
    return detector.changes();
  }
}

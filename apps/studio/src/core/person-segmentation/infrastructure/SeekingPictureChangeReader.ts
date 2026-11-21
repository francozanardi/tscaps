import type { EditorStore } from '@core/editor/store/EditorStore';
import { PictureChangeDetector } from '@core/preview/services/PictureChangeDetector';
import type { FrameThumbnailReader } from '@core/person-segmentation/services/FrameThumbnailReader';
import type { HiddenVideoLoader } from '@core/person-segmentation/services/HiddenVideoLoader';
import type { PrefetchingVideoFrameReader } from '@core/person-segmentation/services/PrefetchingVideoFrameReader';
import type { ScanVideoSourceIdentity, ScanVideoSourceResolver } from '@core/person-segmentation/services/ScanVideoSourceResolver';
import type { PictureChangeReader } from '@core/shots/domain/PictureChangeReader';

/**
 * Finds the source's picture changes by seeking through the video the
 * detector decodes, for a video whose preview pass did not find them.
 *
 * The whole video is looked at a few frames a second, which finds every
 * change but places it only within the gap between two looks; each one
 * is then placed on its frame by looking at every frame of that gap.
 * Seconds of seeking for a minute of video, told to `onProgress` as it
 * goes. What it finds is remembered for that video, so asking again
 * while it is loaded reads nothing and reports no progress. It
 * is not written into the project: the shots the editor proposes follow
 * the picture changes it knows, and an edit undone must give back the
 * proposal it replaced.
 */
export class SeekingPictureChangeReader implements PictureChangeReader {
  /** Looks per second over the whole video. */
  private static readonly COARSE_FPS = 6;
  /** Looks per second inside a gap a change was found in: about every frame. */
  private static readonly FINE_FPS = 30;
  /** The share of the search that the look at the whole video is; placing each change on its frame is the rest. */
  private static readonly COARSE_SHARE = 0.85;

  private remembered: { readonly video: ScanVideoSourceIdentity; readonly changes: ReadonlyArray<number> } | null = null;

  constructor(
    private readonly editorStore: EditorStore,
    private readonly sourceResolver: ScanVideoSourceResolver,
    private readonly videoLoader: HiddenVideoLoader,
    private readonly frameReader: PrefetchingVideoFrameReader,
    private readonly thumbnails: FrameThumbnailReader,
  ) {}

  async read(onProgress: (fraction: number) => void = () => undefined): Promise<ReadonlyArray<number>> {
    const state = this.editorStore.snapshot();
    const identity = this.sourceResolver.identityOf(state.video);
    if (identity !== null && this.remembered?.video === identity) return this.remembered.changes;
    const source = this.sourceResolver.resolve(state.video);
    if (source === null) throw new Error('No video is loaded');
    try {
      const video = await this.videoLoader.load(source.url);
      try {
        const changes = await this.changesIn(video, state.video.duration, onProgress);
        if (identity !== null) this.remembered = { video: identity, changes };
        return changes;
      } finally {
        this.videoLoader.dispose(video);
      }
    } finally {
      source.dispose();
    }
  }

  private async changesIn(video: HTMLVideoElement, durationSec: number, onProgress: (fraction: number) => void): Promise<number[]> {
    const step = 1 / SeekingPictureChangeReader.COARSE_FPS;
    const coarseShare = SeekingPictureChangeReader.COARSE_SHARE;
    const coarse = await this.changesAt(video, this.timesBetween(0, durationSec, step), (looked) => onProgress(looked * coarseShare));
    const placed: number[] = [];
    for (const changeSec of coarse) {
      placed.push(await this.placed(video, changeSec, step));
      onProgress(coarseShare + (1 - coarseShare) * (placed.length / coarse.length));
    }
    return placed;
  }

  /** The first frame of the new picture in the gap of `step` that ends at `changeSec`; `changeSec` where none stands out. */
  private async placed(video: HTMLVideoElement, changeSec: number, step: number): Promise<number> {
    const fine = this.timesBetween(Math.max(0, changeSec - step), changeSec, 1 / SeekingPictureChangeReader.FINE_FPS);
    fine.push(changeSec);
    const found = await this.changesAt(video, fine, () => undefined);
    return found[0] ?? changeSec;
  }

  /** The changes among the pictures at `times`; `onLooked` is told the share of them looked at so far, after each one. */
  private async changesAt(video: HTMLVideoElement, times: ReadonlyArray<number>, onLooked: (share: number) => void): Promise<number[]> {
    const detector = new PictureChangeDetector();
    let looked = 0;
    for await (const frame of this.frameReader.read(video, times, new AbortController().signal)) {
      try {
        detector.observe(frame.timestamp, this.thumbnails.pixelsOf(frame.bitmap));
      } finally {
        frame.bitmap.close();
      }
      looked += 1;
      onLooked(looked / times.length);
    }
    return detector.changes();
  }

  /** Times from `fromSec` up to, not including, `toSec`, `step` apart. */
  private timesBetween(fromSec: number, toSec: number, step: number): number[] {
    const times: number[] = [];
    for (let index = 0; fromSec + index * step < toSec - step / 2; index += 1) times.push(fromSec + index * step);
    return times;
  }
}

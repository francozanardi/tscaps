import type { VideoTake } from '@core/reframe/domain/VideoTake';
import type { EditorStore } from '@core/editor/store/EditorStore';
import type { PictureChangeReader } from '@core/shots/domain/PictureChangeReader';

// A stretch this short between two picture changes is a flash or a dissolve, not a take of its own.
const MIN_TAKE_SEC = 0.3;

/**
 * The takes of the open project's source video: the stretches between
 * its own picture changes, as the project knows them or, where it does
 * not, as the reader finds them. A stretch too short to be a take is
 * folded into the take before it, and a take the cuts remove whole is
 * left out.
 */
export class VideoTakes {
  constructor(
    private readonly store: EditorStore,
    private readonly pictureChanges: PictureChangeReader,
  ) {}

  /**
   * Every take kept in the output, in time order; empty while there is
   * no video. `onProgress` is told how far the search for the picture
   * changes is, from 0 to 1, where the project does not know them yet.
   */
  async read(onProgress?: (fraction: number) => void): Promise<VideoTake[]> {
    const { video } = this.store.snapshot();
    if (!(video.duration > 0)) return [];
    const changes = video.pictureChangesSec ?? await this.pictureChanges.read(onProgress);
    const bounds = this.boundsOf(changes, video.duration);
    const cuts = this.store.snapshot().cuts;
    const takes: VideoTake[] = [];
    for (let index = 0; index < bounds.length - 1; index += 1) {
      const [startSec, endSec] = [bounds[index]!, bounds[index + 1]!];
      if (cuts.containsTimeRange(startSec, endSec)) continue;
      takes.push({ index: takes.length, startSec, endSec });
    }
    return takes;
  }

  /** Where takes start and end: the video's ends and every change far enough from the one before. */
  private boundsOf(changes: ReadonlyArray<number>, durationSec: number): number[] {
    const bounds = [0];
    for (const change of [...changes].sort((first, second) => first - second)) {
      if (change - bounds[bounds.length - 1]! < MIN_TAKE_SEC || durationSec - change < MIN_TAKE_SEC) continue;
      bounds.push(change);
    }
    bounds.push(durationSec);
    return bounds;
  }
}

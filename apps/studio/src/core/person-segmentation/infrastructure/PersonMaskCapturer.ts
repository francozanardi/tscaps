import { MaskCache } from '@core/person-segmentation/domain/MaskCache';
import type { PersonSegmentationWindow } from '@core/person-segmentation/domain/PersonSegmentationWindow';
import type { VideoFrameBitmapCapturer } from '@core/person-segmentation/services/VideoFrameBitmapCapturer';
import type { VideoFrameSeeker } from '@core/person-segmentation/services/VideoFrameSeeker';
import type { PersonSegmenterWorkerClient } from '@core/person-segmentation/infrastructure/PersonSegmenterWorkerClient';

/**
 * Collects actor confidence masks across the given time ranges of a
 * video. Seeks each range at a fixed capture fps, runs the supplied
 * worker client's person segmenter at every timestamp, and returns
 * the downsampled alpha bytes in a `MaskCache` keyed by time.
 *
 * Progress is reported through `onFraction` as `[0, 1]` over the sum
 * of the given ranges' durations. An empty ranges list resolves
 * immediately with an empty cache. Aborting the supplied signal stops
 * the walk at the next sample and throws.
 */
export class PersonMaskCapturer {

  constructor(
    private readonly seeker: VideoFrameSeeker,
    private readonly capturer: VideoFrameBitmapCapturer,
    private readonly workerClient: PersonSegmenterWorkerClient,
  ) {}

  async capture(
    video: HTMLVideoElement,
    ranges: ReadonlyArray<PersonSegmentationWindow>,
    cacheFps: number,
    signal: AbortSignal,
    onFraction: (fraction: number) => void,
  ): Promise<MaskCache> {
    const cache = new MaskCache();
    const step = 1 / cacheFps;
    const totalDuration = this.totalDurationSec(ranges);
    if (totalDuration <= 0) {
      onFraction(1);
      return cache;
    }
    let elapsed = 0;
    for (const range of ranges) {
      for (let timestamp = range.start; timestamp <= range.end; timestamp += step) {
        signal.throwIfAborted();
        await this.captureOne(video, timestamp, cache);
        elapsed += step;
        onFraction(Math.min(1, elapsed / totalDuration));
      }
    }
    return cache;
  }

  /**
   * Collects one mask per given timestamp, in the given order. The
   * timestamps must be strictly increasing. Progress is reported
   * through `onFraction` as `[0, 1]` over the timestamp count; an
   * empty list resolves immediately with an empty cache. Aborting the
   * supplied signal stops the walk at the next sample and throws.
   */
  async captureAtTimestamps(
    video: HTMLVideoElement,
    timestamps: ReadonlyArray<number>,
    signal: AbortSignal,
    onFraction: (fraction: number) => void,
  ): Promise<MaskCache> {
    const cache = new MaskCache();
    if (timestamps.length === 0) {
      onFraction(1);
      return cache;
    }
    for (let index = 0; index < timestamps.length; index++) {
      signal.throwIfAborted();
      await this.captureOne(video, timestamps[index]!, cache);
      onFraction((index + 1) / timestamps.length);
    }
    return cache;
  }

  private async captureOne(video: HTMLVideoElement, timestamp: number, cache: MaskCache): Promise<void> {
    await this.seeker.seekTo(video, timestamp);
    const bitmap = await this.capturer.capture(video);
    const mask = await this.workerClient.segmentPerson(bitmap, Math.round(timestamp * 1000), timestamp);
    cache.add(mask);
  }

  private totalDurationSec(ranges: ReadonlyArray<PersonSegmentationWindow>): number {
    return ranges.reduce((total, range) => total + (range.end - range.start), 0);
  }
}

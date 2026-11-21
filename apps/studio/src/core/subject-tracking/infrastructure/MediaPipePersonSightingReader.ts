import type { PersonSightingReader } from '@core/subject-tracking/domain/PersonSightingReader';
import type { SamplingStretch } from '@core/subject-tracking/domain/SamplingStretch';
import type { SightedFrame } from '@core/subject-tracking/domain/SightedFrame';
import type { SampledFrame, VideoFrameSampler } from '@core/subject-tracking/domain/VideoFrameSampler';
import type { PersonSightingWorkerClient } from '@core/subject-tracking/infrastructure/PersonSightingWorkerClient';

/**
 * Finds the people in a video's frames with MediaPipe, in a worker,
 * while the next frame is being decoded: the floor is the slower of
 * decoding and detecting, not their sum.
 *
 * A read that fails partway is taken up once more after the last frame
 * read, with a new decoder and a new worker: when Safari restarts its
 * GPU process under load, the decoder fails and the models lose their
 * context, and both work again once made anew.
 */
export class MediaPipePersonSightingReader implements PersonSightingReader {
  constructor(
    private readonly sampler: VideoFrameSampler,
    private readonly worker: PersonSightingWorkerClient,
  ) {}

  async read(
    video: Blob,
    stretches: ReadonlyArray<SamplingStretch>,
    signal: AbortSignal,
    onProgress: (fraction: number) => void,
  ): Promise<SightedFrame[]> {
    const frames: SightedFrame[] = [];
    try {
      await this.readInto(frames, video, stretches, stretches, signal, onProgress);
    } catch (error) {
      if (signal.aborted) throw error;
      this.worker.restart();
      await this.readInto(frames, video, this.leftAfter(frames, stretches), stretches, signal, onProgress);
    }
    signal.throwIfAborted();
    onProgress(1);
    return frames;
  }

  /** Reads `toRead` into `frames`, telling progress through `all`. */
  private async readInto(
    frames: SightedFrame[],
    video: Blob,
    toRead: ReadonlyArray<SamplingStretch>,
    all: ReadonlyArray<SamplingStretch>,
    signal: AbortSignal,
    onProgress: (fraction: number) => void,
  ): Promise<void> {
    await this.worker.ensureReady();
    let inFlight: Promise<SightedFrame> | null = null;
    for await (const frame of this.sampler.sample(video, toRead, signal)) {
      if (inFlight !== null) frames.push(await inFlight);
      inFlight = this.sighted(frame);
      // A detection that fails while the next frame decodes is reported when it is awaited, not as unhandled.
      inFlight.catch(() => undefined);
      onProgress(this.progressAt(frame.sourceSec, all));
    }
    if (inFlight !== null) frames.push(await inFlight);
  }

  /** What is left of the stretches after the last of `frames`, at their rates. */
  private leftAfter(frames: ReadonlyArray<SightedFrame>, stretches: ReadonlyArray<SamplingStretch>): SamplingStretch[] {
    const last = frames.at(-1)?.sourceSec;
    if (last === undefined) return [...stretches];
    return stretches.flatMap((stretch) => {
      const startSec = Math.max(stretch.startSec, last + 1 / stretch.framesPerSecond);
      return startSec < stretch.endSec ? [{ ...stretch, startSec }] : [];
    });
  }

  private async sighted(frame: SampledFrame): Promise<SightedFrame> {
    return { sourceSec: frame.sourceSec, people: await this.worker.sight(frame.bitmap) };
  }

  /** How far through the stretches `sourceSec` is, by their lengths. */
  private progressAt(sourceSec: number, stretches: ReadonlyArray<SamplingStretch>): number {
    const total = stretches.reduce((sum, stretch) => sum + (stretch.endSec - stretch.startSec), 0);
    if (total <= 0) return 1;
    let done = 0;
    for (const stretch of stretches) {
      if (sourceSec < stretch.endSec) return Math.min(1, (done + Math.max(0, sourceSec - stretch.startSec)) / total);
      done += stretch.endSec - stretch.startSec;
    }
    return 1;
  }
}

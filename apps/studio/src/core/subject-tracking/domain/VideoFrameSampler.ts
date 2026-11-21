import type { SamplingStretch } from '@core/subject-tracking/domain/SamplingStretch';

/** A frame of the source video, shown at `sourceSec`, drawn small enough for a detector. Its bitmap belongs to whoever takes it. */
export interface SampledFrame {
  readonly sourceSec: number;
  readonly bitmap: ImageBitmap;
}

/** Reads frames of a video at a rate, stretch by stretch, decoding each stretch in order rather than seeking to each moment. */
export interface VideoFrameSampler {
  /**
   * For each stretch in turn, the frames shown at its start and every
   * `1 / framesPerSecond` after it, up to its end, each at most 480 px
   * on its short side and turned upright. A frame shown at several of
   * those moments is given once. The caller closes every bitmap it is
   * given; stopping early releases the decoder. Throws an `AbortError`
   * once `signal` fires, and the cause where the video cannot be read.
   */
  sample(video: Blob, stretches: ReadonlyArray<SamplingStretch>, signal: AbortSignal): AsyncGenerator<SampledFrame>;
}

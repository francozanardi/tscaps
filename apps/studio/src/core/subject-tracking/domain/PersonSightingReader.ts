import type { SamplingStretch } from '@core/subject-tracking/domain/SamplingStretch';
import type { SightedFrame } from '@core/subject-tracking/domain/SightedFrame';

/**
 * Finds the people in frames of a video: for each stretch, frames at
 * its rate from its start, each with everyone seen in it.
 */
export interface PersonSightingReader {
  /**
   * The frames of `video` the stretches ask for, in time order, the
   * first of each stretch at its start. `onProgress` is told how far
   * through the stretches the reading is, from 0 to 1. Rejects with an
   * `AbortError` once `signal` fires, and with the cause where the
   * video cannot be decoded or the detector cannot run.
   */
  read(
    video: Blob,
    stretches: ReadonlyArray<SamplingStretch>,
    signal: AbortSignal,
    onProgress: (fraction: number) => void,
  ): Promise<SightedFrame[]>;
}

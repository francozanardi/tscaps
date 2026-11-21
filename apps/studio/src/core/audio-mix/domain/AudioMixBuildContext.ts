import type { AudioSourceLengths } from '@core/audio-mix/domain/AudioSourceLengths';
import type { AudioTimingContext } from '@core/audio-mix/domain/AudioTimingContext';

/** The edit a mix is resolved against, and how long each file it plays runs. */
export interface AudioMixBuildContext extends AudioTimingContext {
  readonly sourceLengths: AudioSourceLengths;
}

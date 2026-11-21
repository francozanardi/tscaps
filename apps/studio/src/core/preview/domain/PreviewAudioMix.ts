import type { AudioDuck, AudioLayer } from '@tscaps/engine';

/**
 * What a preview mixes with the video's own sound, as the export mixes
 * it: the engine's audio layers, in output time, and the video's own
 * level over time.
 */
export interface PreviewAudioMix {
  /** Summed in any order. */
  readonly layers: ReadonlyArray<AudioLayer>;
  /** The video's own sound, linear; 0 silences it. */
  readonly inputGain: number;
  /** Where the video's own sound plays at another level, on top of `inputGain`, their gains multiplied. */
  readonly inputDucks: ReadonlyArray<AudioDuck>;
  /** Length of the output, after the cuts; `Infinity` while it is not known. */
  readonly outputDurationSec: number;
}

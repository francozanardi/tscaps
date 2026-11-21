import type { AudioSourceRef } from '@core/audio-mix/domain/AudioSourceRef';
import type { AudioTimeSpan } from '@core/audio-mix/domain/AudioTimeSpan';

/** Lowering a layer over stretches of output time. */
export interface AudioMixLayerDuck {
  readonly ranges: ReadonlyArray<AudioTimeSpan>;
  /** Linear, applied over each range. */
  readonly gain: number;
  /** The ramp down, finishing at a range's start. */
  readonly attackSec: number;
  /** The ramp up, starting at a range's end. */
  readonly releaseSec: number;
}

/**
 * A clip with every anchor resolved: when it plays on the output, from
 * where in its file, how loud, and where it is lowered. Field for field
 * the engine's audio layer, with the file still named rather than read.
 */
export interface AudioMixLayer {
  /** The clip's id, or the shot layer's for a b-roll's own sound. */
  readonly id: string;
  /**
   * What it is: a clip the user placed, or a b-roll's own sound. A
   * b-roll whose file holds no sound to play is simply silent, so only a
   * clip's missing file is worth asking about.
   */
  readonly kind: 'clip' | 'footage';
  readonly source: AudioSourceRef;
  readonly outputStartSec: number;
  /** Infinity: until the file ends, or the output does. */
  readonly outputEndSec: number;
  readonly sourceStartSec: number;
  /** Start over from `sourceStartSec` after this long; Infinity plays once. */
  readonly sourcePassSec: number;
  /** Linear. */
  readonly gain: number;
  readonly fadeInSec: number;
  /** Ends at `outputEndSec`, or at the output's end. */
  readonly fadeOutSec: number;
  readonly duck: AudioMixLayerDuck | null;
}

/** What is mixed with the video's own sound. */
export interface ResolvedAudioMix {
  readonly layers: ReadonlyArray<AudioMixLayer>;
  /** The video's own sound, linear; 0 silences it. */
  readonly inputGain: number;
  /** Where the video's own sound plays at another level, on top of `inputGain`: one per level, each over its shots. */
  readonly inputDucks: ReadonlyArray<AudioMixLayerDuck>;
}

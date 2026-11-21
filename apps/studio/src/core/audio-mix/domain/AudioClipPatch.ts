import type { AudioAnchorPoint } from '@core/audio-mix/domain/AudioAnchorPoint';
import type { AudioClipDucking } from '@core/audio-mix/domain/AudioClip';
import type { AudioSourceRef } from '@core/audio-mix/domain/AudioSourceRef';

/**
 * The settings of a clip to change; a field left out stays as each
 * clip has it. A role is not patched: it only chose the defaults the
 * clip was added with.
 */
export interface AudioClipPatch {
  readonly source?: AudioSourceRef;
  readonly start?: AudioAnchorPoint;
  /**
   * How far from its start anchor each clip plays, in seconds of output
   * time, each keeping the anchor it has: what moves clips placed
   * against different things by the same amount. Applied after `start`.
   */
  readonly startOffsetSec?: number;
  /** `null` takes the end anchor away. */
  readonly end?: AudioAnchorPoint | null;
  readonly inSec?: number;
  readonly loop?: boolean;
  readonly volume?: number;
  readonly fadeInSec?: number;
  readonly fadeOutSec?: number;
  readonly ducking?: Partial<AudioClipDucking>;
}

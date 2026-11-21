import type { AudioAnchorPoint } from '@core/audio-mix/domain/AudioAnchorPoint';
import type { AudioSourceRef } from '@core/audio-mix/domain/AudioSourceRef';

/** What a clip is for. It sets the defaults a clip is added with and where it is offered, never how it plays. */
export type AudioClipRole = 'effect' | 'music';

/** Whether a clip is lowered while somebody speaks, and by how much, in decibels (negative). */
export interface AudioClipDucking {
  readonly enabled: boolean;
  readonly depthDb: number;
}

/**
 * A sound placed against the edit rather than against a clock: it
 * starts at its start anchor and, with an end anchor, runs until it.
 * Without one it plays its file once from `inSec`, or, looping, until
 * the output ends. With one it is trimmed or looped to fill the span,
 * its fade out landing on the end.
 */
export interface AudioClip {
  readonly id: string;
  readonly role: AudioClipRole;
  readonly source: AudioSourceRef;
  readonly start: AudioAnchorPoint;
  readonly end: AudioAnchorPoint | null;
  /** Where in the file playback starts, in seconds. */
  readonly inSec: number;
  /** Start over from `inSec` at the file's end, as long as the clip runs. */
  readonly loop: boolean;
  /** Linear gain, 0 to 2. */
  readonly volume: number;
  readonly fadeInSec: number;
  /** Lands on the clip's end. */
  readonly fadeOutSec: number;
  readonly ducking: AudioClipDucking;
}

import type { BuiltinSoundCategory } from '@core/audio-mix/domain/BuiltinSoundCategory';

/** A sound of the pack bundled with the app, which a clip names by `id`. */
export interface BuiltinSound {
  /** Stable for good: a stored clip names it, so it is never renamed or reused. */
  readonly id: string;
  /** What the sound is called where it is offered. */
  readonly name: string;
  readonly category: BuiltinSoundCategory;
  /** How long the file plays, in seconds. */
  readonly lengthSec: number;
  /** What it sounds like and the moment it suits, for someone choosing it without hearing it. */
  readonly description: string;
  /**
   * The volume (1 is the file's own) at which it sits under a spoken
   * voice, felt more than heard. The files are mastered to one peak, not
   * to one loudness, so this differs from sound to sound: a heavy hit
   * plays far quieter than a soft click for the two to sit alike.
   */
  readonly underVoiceVolume: number;
  /** Where the file is fetched from, under the path the app is served at. */
  readonly url: string;
}

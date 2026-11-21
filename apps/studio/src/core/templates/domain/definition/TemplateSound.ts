/**
 * A sound a template plays on the words of its captions: on every word
 * its tag expression holds for, at the moment the word is said. Like a
 * graphic's sounds, it is placed once, when the template is applied, as
 * an ordinary effect the person can then move, change or remove.
 */
export interface TemplateSound {
  /** Tag expression a word's tags must satisfy (`"peak or hook"`). */
  readonly when: string;
  /** Whether the word must also be the only one of its caption. */
  readonly alone: boolean;
  /** A bundled sound's id. */
  readonly soundId: string;
  /** Linear gain, 0 to 1. */
  readonly volume: number;
  /** Seconds from the word's start, negative to land before it. */
  readonly offsetSec: number;
  /**
   * Seconds a word must start after the last word this sound was placed
   * on to get it too; a word said sooner is passed over, so fast speech
   * thins the sound out rather than stacking it. 0 places it on every word.
   */
  readonly minGapSec: number;
}

/** One sound being heard through a {@link SoundAuditionOutput}. */
export interface SoundAuditionVoice {
  /** Changes its level while it plays, linear: 1 is the file as it is, up to 2. */
  setGain(gain: number): void;
  /** Silences it for good and lets its file go. Idempotent; `onEnded` is not called for it. */
  stop(): void;
}

/**
 * Where a sound is heard before it is placed, apart from the preview and
 * its clock: a file played once, from a point in it, at a level that can
 * change while it plays.
 */
export interface SoundAuditionOutput {
  /**
   * Starts playing `file` (an address, or the file itself) from
   * `startSec` at `gain`. `onEnded` is called once, when it reaches its
   * end or cannot be played; never after {@link SoundAuditionVoice.stop}.
   */
  play(file: string | Blob, startSec: number, gain: number, onEnded: () => void): SoundAuditionVoice;
}

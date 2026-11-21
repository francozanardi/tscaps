/**
 * Tells whether this browser can play an audio file, by decoding the
 * start of it the way its sound is decoded to be heard and mixed.
 */
export interface AudioPlaybackProbe {
  /** Resolves when the file's sound can be decoded here; rejects with why it cannot. Keeps nothing decoded. */
  ensurePlayable(audio: Blob): Promise<void>;
}

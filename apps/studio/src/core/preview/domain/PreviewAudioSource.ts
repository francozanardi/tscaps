/** A stretch of decoded sound, placed on its file's timeline. */
export interface PreviewAudioChunk {
  readonly buffer: AudioBuffer;
  /** Where the buffer's first frame sits in the file, in seconds. */
  readonly timestampSec: number;
}

/**
 * The decoded sound of one audio file, read a stretch at a time. Whether
 * it is held whole or decoded as it is read is the implementation's
 * business; a reader sees chunks either way.
 */
export interface PreviewAudioSource {
  /** How long the file plays, in seconds. */
  readonly durationSec: number;

  /**
   * The file's sound from `sourceSec` on, in order and without gaps. The
   * first chunk may start before `sourceSec`. Each iteration reads on
   * its own, so several may run at once; ending one early releases what
   * it decodes with.
   */
  chunksFrom(sourceSec: number): AsyncIterable<PreviewAudioChunk>;

  /** Releases what the source holds. Iterations still running end with an error. */
  dispose(): void;
}

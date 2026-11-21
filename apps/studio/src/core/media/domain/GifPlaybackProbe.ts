/**
 * Tells whether this browser can play the frames of a GIF, through the
 * same decoders that play it on screen and into an exported video.
 */
export interface GifPlaybackProbe {
  /** Resolves when the GIF can play here; rejects with why it cannot. Keeps nothing decoded. */
  ensurePlayable(gif: Blob): Promise<void>;
}

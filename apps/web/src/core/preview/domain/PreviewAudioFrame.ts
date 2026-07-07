/**
 * A single decoded audio sample chunk ready to be scheduled on a
 * Web Audio graph. Hides the decoder behind the source timestamp
 * plus an `AudioBuffer` accessor that the audio pump connects to a
 * buffer-source node.
 *
 * Each frame holds a transient buffer that must be released via
 * {@link close} once it has been scheduled (or dropped).
 */
export interface PreviewAudioFrame {
  readonly timestampSec: number;
  toAudioBuffer(): AudioBuffer;
  close(): void;
}

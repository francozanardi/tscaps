import type { Output } from 'mediabunny';

/**
 * Bridges the input file's audio track to the output.
 *
 * Lifecycle: {@link attachTo} once before output start, {@link pumpUntil}
 * once per encoded video frame to keep audio in lockstep, and
 * {@link finish} once after the last video frame to drain any remaining
 * data before the output is finalized.
 */
export interface AudioTrackBridge {
  /**
   * Wires the bridge into the output. Must be called once before the
   * output is started.
   */
  attachTo(output: Output): Promise<void>;
  /**
   * Pushes any pending audio data whose timestamp is at or before
   * `videoTimestamp` (in seconds) into the output.
   */
  pumpUntil(videoTimestamp: number): Promise<void>;
  /** Drains all remaining audio data into the output. */
  finish(): Promise<void>;
}

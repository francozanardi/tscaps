/**
 * Decodes audio samples from the loaded source and schedules them
 * on the audio rendering graph so they arrive at their output time
 * in lockstep with the playback clock.
 *
 * One continuous task runs at a time. `startFromOutputTime` cancels
 * any in-flight task (and stops every node already queued ahead of
 * the current audio-context time) and starts a fresh decode from
 * the requested output position.
 *
 * `primeFirstFrame` decodes (without scheduling) one sample frame at
 * output zero so the underlying decoder is warm before the first
 * `startFromOutputTime`. Without it, the ~hundreds-of-ms cold-start
 * latency between `play()` and the first scheduled frame causes the
 * pump to drop frames whose timestamps already fall behind the
 * audio-context clock — leaving the start of playback silent.
 */
export interface AudioSamplePump {
  startFromOutputTime(outputSec: number): void;
  cancel(): void;
  primeFirstFrame(): Promise<void>;
}

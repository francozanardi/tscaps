/** The transcription cap that applies to a caller right now. */
export type TranscriptionAudioLengthCap =
  | { readonly state: 'no-cap' }
  | { readonly state: 'has-cap'; readonly seconds: number };

/**
 * Per-request duration cap for a transcription attempt, so a caller
 * can refuse an over-long video before invoking a pipeline the server
 * would refuse anyway.
 *
 * Rejects when the source of the cap cannot be read: an unknown cap
 * is not the same as no cap.
 */
export interface TranscriptionAudioLengthPolicy {
  resolveCap(): Promise<TranscriptionAudioLengthCap>;
}

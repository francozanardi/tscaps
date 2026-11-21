import type { Document, UntranscribedRegion } from '@tscaps/engine';

/**
 * What one transcription call produced: the `document` of timed words,
 * and the regions of the audio the call could not transcribe, empty
 * when it covered all of it.
 */
export interface TranscriptionResult {
  readonly document: Document;
  readonly untranscribedRegions: readonly UntranscribedRegion[];
}

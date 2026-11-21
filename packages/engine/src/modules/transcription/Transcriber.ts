import type { Document } from '@modules/document/Document';

export interface TranscriberOptions {
  language?: string;
}

/**
 * Progress signal emitted by a `Transcriber`. The `loading` stage covers
 * model or asset acquisition and reports a real `[0, 1]` value. The
 * `inferring` stage covers the actual transcription pass and may carry a
 * real progress value when the underlying implementation exposes one;
 * many do not, in which case the field is omitted.
 */
export type TranscriberProgressEvent =
  | { stage: 'loading'; progress: number }
  | { stage: 'inferring'; progress?: number };

/**
 * An audio region, in absolute seconds, that transcription deliberately
 * left empty because decoding produced no trustworthy output for it.
 */
export interface UntranscribedRegion {
  startSeconds: number;
  endSeconds: number;
}

export interface Transcriber {
  onProgress?: (event: TranscriberProgressEvent) => void;
  /**
   * Fired at most once per region, before `transcribe` resolves.
   * Implementations that always cover the full audio never fire it.
   */
  onUntranscribedRegion?: (region: UntranscribedRegion) => void;
  transcribe(audio: Blob, options?: TranscriberOptions): Promise<Document>;
}

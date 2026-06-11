import type { Document } from '@modules/document/index';

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

export interface Transcriber {
  onProgress?: (event: TranscriberProgressEvent) => void;
  transcribe(audio: Blob, options?: TranscriberOptions): Promise<Document>;
}

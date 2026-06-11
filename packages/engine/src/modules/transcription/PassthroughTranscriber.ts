import type { Document } from '@modules/document/index';
import type {
  Transcriber,
  TranscriberOptions,
  TranscriberProgressEvent,
} from '@modules/transcription/Transcriber';

/**
 * Returns a Document supplied up front instead of running any audio
 * analysis. Lets a caller drive a transcription-shaped pipeline starting
 * from a Document they already have — typical when the document came
 * from an earlier run, an external pipeline, or a hand-built fixture —
 * without changing the orchestrator's shape.
 *
 * Emits a single `inferring` progress event with `progress: 1` so
 * listeners that mirror a real transcriber see the same event shape
 * and don't have to special-case the bypass.
 */
export class PassthroughTranscriber implements Transcriber {
  onProgress?: (event: TranscriberProgressEvent) => void;

  constructor(private readonly document: Document) {}

  async transcribe(_audio: Blob, _options?: TranscriberOptions): Promise<Document> {
    this.onProgress?.({ stage: 'inferring', progress: 1 });
    return this.document;
  }
}

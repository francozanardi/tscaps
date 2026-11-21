import type { PreprocessingProgressPhase } from '@core/preprocessing/domain/PreprocessingProgressStatus';
import type { TranscriptionRequest } from '@core/transcription/domain/TranscriptionRequest';
import type { TranscriptionRequester } from '@core/transcription/domain/TranscriptionRequester';
import type { TranscriptionResult } from '@core/transcription/domain/TranscriptionResult';

/**
 * The editor's transcriber: turns a video's audio into a `Document`
 * of timed words.
 *
 * Everything about a call travels with it, since two calls can be in
 * flight at once. The call reports its progress to the `requester`'s
 * progress, and a transcriber that keeps the transcript somewhere files
 * it under the `requester`'s project. `request` says how to transcribe,
 * with a `config` whose shape the concrete transcriber owns, which
 * keeps the editor decoupled from any specific implementation. The
 * result carries the regions the call could not transcribe; a
 * transcriber that always covers the full audio returns none.
 *
 * `initialPhase` is the first phase a call enters.
 */
export interface ConfigurableTranscriber {
  readonly initialPhase: PreprocessingProgressPhase;
  transcribe(audio: Blob, requester: TranscriptionRequester, request: TranscriptionRequest): Promise<TranscriptionResult>;
}

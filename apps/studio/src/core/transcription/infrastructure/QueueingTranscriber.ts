import type { PreprocessingProgressPhase } from '@core/preprocessing/domain/PreprocessingProgressStatus';
import type { ConfigurableTranscriber } from '@core/transcription/domain/ConfigurableTranscriber';
import type { TranscriptionRequest } from '@core/transcription/domain/TranscriptionRequest';
import type { TranscriptionRequester } from '@core/transcription/domain/TranscriptionRequester';
import type { TranscriptionResult } from '@core/transcription/domain/TranscriptionResult';

/**
 * Runs the calls of the transcriber it wraps one at a time, in the
 * order they came, for a transcriber that can only do one at a time.
 *
 * A call that has to wait says so on its requester's progress, in the
 * `queued` phase, and starts again from the wrapped transcriber's first
 * phase when its turn comes. A call that fails hands the turn to the
 * next one all the same.
 */
export class QueueingTranscriber implements ConfigurableTranscriber {
  private turnsTaken: Promise<void> = Promise.resolve();
  private callsInFlight = 0;

  constructor(private readonly inner: ConfigurableTranscriber) {}

  get initialPhase(): PreprocessingProgressPhase {
    return this.inner.initialPhase;
  }

  transcribe(audio: Blob, requester: TranscriptionRequester, request: TranscriptionRequest): Promise<TranscriptionResult> {
    const waits = this.callsInFlight > 0;
    this.callsInFlight += 1;
    if (waits) requester.progress.start('queued');
    const call = this.turnsTaken.then(() => {
      if (waits) requester.progress.start(this.inner.initialPhase);
      return this.inner.transcribe(audio, requester, request);
    });
    this.turnsTaken = call.then(() => undefined, () => undefined);
    return call.finally(() => {
      this.callsInFlight -= 1;
    });
  }
}

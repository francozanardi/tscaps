import { AppError } from '@core/_shared/domain/AppError';

/**
 * Raised when a local in-browser transcription run could not finish.
 * Covers worker spawn failures, worker crashes, model download
 * problems, and any decoder / Whisper crash that surfaces through the
 * worker bridge. The underlying error is preserved in `cause` so
 * support tooling can inspect the actual failure mode.
 */
export class LocalTranscriptionFailedError extends AppError {
  readonly name = 'LocalTranscriptionFailedError';

  constructor(options: { cause: unknown }) {
    super('Local transcription failed', options);
  }
}

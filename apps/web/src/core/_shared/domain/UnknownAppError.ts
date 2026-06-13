import { AppError } from '@core/_shared/domain/AppError';

/**
 * Catch-all wrapper for thrown values that are not part of the typed
 * error hierarchy. The original value is preserved verbatim in
 * `cause` so telemetry and support can inspect the underlying
 * library / browser error without losing information.
 */
export class UnknownAppError extends AppError {
  readonly name = 'UnknownAppError';

  constructor(options: { cause: unknown }) {
    super('Unknown application error', options);
  }
}

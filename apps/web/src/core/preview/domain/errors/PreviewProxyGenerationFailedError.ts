import { AppError } from '@core/_shared/domain/AppError';

/**
 * Raised by a `PreviewProxyGenerator` when the source video could
 * not be re-encoded into a proxy. Describes what failed (proxy
 * generation) without reference to the caller's pipeline. The
 * underlying library / browser error is preserved verbatim in
 * `cause` for telemetry and support inspection.
 */
export class PreviewProxyGenerationFailedError extends AppError {
  readonly name = 'PreviewProxyGenerationFailedError';

  constructor(options: { cause: unknown }) {
    super('Preview proxy generation failed', options);
  }
}

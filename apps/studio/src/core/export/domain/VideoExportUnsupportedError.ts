import { AppError } from '@core/errors/domain/AppError';

/**
 * Raised when this browser ships no video encoder the export can use,
 * so no export it offers could ever produce a file. Raised upfront,
 * before any work is spent on a video, rather than at the end of a
 * render that was doomed from the start.
 */
export class VideoExportUnsupportedError extends AppError {
  readonly name = 'VideoExportUnsupportedError';

  constructor(options?: { cause?: unknown }) {
    super('No video encoder available in this browser for any export format', { cause: options?.cause });
  }
}

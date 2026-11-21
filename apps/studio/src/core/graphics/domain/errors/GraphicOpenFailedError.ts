import { AppError } from '@core/errors/domain/AppError';

/**
 * Raised when a graphic could not be opened to be played. Names the
 * operation, never the reason; the reason is in `cause`.
 */
export class GraphicOpenFailedError extends AppError {
  readonly name = 'GraphicOpenFailedError';

  constructor(options: { cause: unknown }) {
    super('Graphic open failed', options);
  }
}

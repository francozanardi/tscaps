import { AppError } from '@core/errors/domain/AppError';

/**
 * Raised when a graphic could not draw a frame. Names the operation,
 * never the reason; the reason is in `cause`.
 */
export class GraphicFrameFailedError extends AppError {
  readonly name = 'GraphicFrameFailedError';

  constructor(options: { cause: unknown }) {
    super('Graphic frame failed', options);
  }
}

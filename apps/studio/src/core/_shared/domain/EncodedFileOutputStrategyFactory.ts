import type { EncodedFileOutputStrategy } from '@core/_shared/domain/EncodedFileOutputStrategy';

/**
 * Builds a fresh {@link EncodedFileOutputStrategy} for a single
 * encoding run. Strategies are stateful (they own workers or file
 * handles for the duration of that run), so each run needs its own
 * instance.
 */
export interface EncodedFileOutputStrategyFactory {
  create(): EncodedFileOutputStrategy;
}

import type { PreviewProxyOutputStrategy } from '@core/preview/domain/PreviewProxyOutputStrategy';

/**
 * Builds a fresh {@link PreviewProxyOutputStrategy} for a single
 * proxy-generation run. Strategies are stateful (they own workers
 * or file handles for the duration of that run), so each generation
 * needs its own instance.
 */
export interface PreviewProxyOutputStrategyFactory {
  create(): PreviewProxyOutputStrategy;
}

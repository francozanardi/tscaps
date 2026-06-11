import { SvgFilterDefinitions } from '@modules/svg-filter/SvgFilterDefinitions';
import type { SvgFilterScopeProvider } from '@modules/svg-filter/SvgFilterScopeProvider';

/**
 * Pairs an `SvgFilterDefinitions` (the parsed filter bodies) with
 * the `SvgFilterScopeProvider` (the strategy that resolves their
 * `var(--…)` placeholders at render time). Definitions and scope
 * are meaningless apart: a definition without a scope can't render,
 * a scope without definitions has nothing to bind.
 */
export class SvgFilterBundle {
  static empty(scopeProvider: SvgFilterScopeProvider): SvgFilterBundle {
    return new SvgFilterBundle(SvgFilterDefinitions.empty(), scopeProvider);
  }

  constructor(
    readonly definitions: SvgFilterDefinitions,
    readonly scopeProvider: SvgFilterScopeProvider,
  ) {}
}

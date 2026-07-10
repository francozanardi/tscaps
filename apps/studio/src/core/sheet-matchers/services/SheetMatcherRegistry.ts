import type { SheetMatcher } from '@core/sheet-matchers/domain/SheetMatcher';

/**
 * Holds the registered matchers as singletons. The dialog iterates over
 * `list()` to render every matcher row (each one queries its own
 * `availability(ctx)` to know whether to render enabled or disabled).
 * Unavailable matchers are not filtered out at this layer — discovery
 * is part of the UX, so the user sees the option and the reason it's
 * disabled.
 */
export class SheetMatcherRegistry {
  constructor(private readonly _matchers: ReadonlyArray<SheetMatcher<unknown>>) {}

  list(): ReadonlyArray<SheetMatcher<unknown>> {
    return this._matchers;
  }
}

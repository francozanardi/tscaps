import type { Document, Segment } from '@tscaps/engine';
import type { Sheet } from '@core/sheets/domain/Sheet';

/**
 * Inputs every matcher inspects to decide its applicability and its
 * default params. Grows over time as new matchers need additional state
 * (e.g. language, speaker count, splitter configs of sheets).
 */
export interface SheetMatcherContext {
  readonly document: Document;
  readonly sheets: ReadonlyArray<Sheet>;
}

/**
 * Result of querying a matcher's `availability(ctx)`. When unavailable,
 * the matcher reports a `code` describing *why* — typically a short
 * kebab-case identifier ("insufficient-speakers", "mixed-speaker-segments")
 * the UI maps to a human-readable message. The core stays free of
 * UI-bound copy and tab names; the dialog owns the translation.
 */
export type SheetMatcherAvailability =
  | { readonly available: true }
  | { readonly available: false; readonly code: string };

/**
 * One auto-assign strategy. Lives as a singleton in the registry; its
 * `matches` method is parameterised so the dialog can build a fresh
 * call without instantiating a new matcher per user gesture. The `type`
 * discriminator is what the UI switches on to render strategy-specific
 * subcontrols, and what the action records so the call is fully
 * identified (matcher + params).
 */
export interface SheetMatcher<TParams> {
  readonly type: string;
  readonly label: string;
  /**
   * Marks a matcher whose underlying feature is unavailable on some
   * surfaces. Consumers on an affected surface render it as a gated
   * affordance (dimmed, non-interactive, with an upgrade pill routing
   * to the landing) instead of a live option.
   */
  readonly cloudOnly?: boolean;
  /**
   * Whether this matcher can operate against the current editor state.
   * The dialog renders unavailable matchers in a disabled row alongside
   * a legend mapped from the returned `code`, instead of hiding them —
   * so the user discovers the feature and learns what's missing.
   */
  availability(ctx: SheetMatcherContext): SheetMatcherAvailability;
  /**
   * Initial params the dialog seeds the form with when the user picks
   * this matcher. Context-aware so e.g. the speaker matcher can default
   * to the first detected speaker.
   */
  defaultParams(ctx: SheetMatcherContext): TParams;
  matches(segment: Segment, params: TParams): boolean;
}

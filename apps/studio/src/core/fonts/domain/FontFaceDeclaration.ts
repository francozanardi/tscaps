import type { FontMetrics } from '@core/fonts/domain/FontMetrics';

/**
 * A `@font-face` rule taken apart, so a consumer can re-emit it under
 * another family name, over another range of code points, or with the
 * vertical metrics it needs — without touching the bytes it points at.
 *
 * Descriptors are held apart rather than as one block of text because
 * three of them are decided by whoever emits the rule and the rest have
 * to survive untouched: `font-weight` and `font-style` are how the
 * browser tells the faces of one family apart, so a rule that loses them
 * collapses a whole family onto its first face.
 */
export interface FontFaceDeclaration {
  /** Family the rule declares, unquoted. */
  readonly family: string;
  /** The `src` value, verbatim. */
  readonly source: string;
  /** The `unicode-range` value, or the empty string when the rule declares none, which covers everything. */
  readonly unicodeRange: string;
  /** Every other descriptor the rule carries, by name, values verbatim. */
  readonly descriptors: ReadonlyMap<string, string>;
  /** Metrics to declare over the face's own, or `null` to leave the face's own in place. */
  readonly metrics: FontMetrics | null;
}

/**
 * The vertical box a face gives a line, as fractions of the font size:
 * how far above the baseline it reaches and how far below.
 *
 * These are the numbers a `@font-face` can declare through
 * `ascent-override` / `descent-override`, which is what makes them worth
 * modelling. Every face of a compiled stack is given the same pair, so
 * the box a caption gets does not depend on which face the engine
 * happens to take it from — the one question CSS answers differently in
 * different browsers.
 *
 * Immutable.
 */
export class FontMetrics {

  constructor(
    readonly ascent: number,
    readonly descent: number,
  ) {}

  /** The box that holds both, so neither face's glyphs fall outside it. */
  mergedWith(other: FontMetrics): FontMetrics {
    return new FontMetrics(Math.max(this.ascent, other.ascent), Math.max(this.descent, other.descent));
  }

  equals(other: FontMetrics): boolean {
    return this.ascent === other.ascent && this.descent === other.descent;
  }
}

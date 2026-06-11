import type { BoxEdges } from '@tscaps/engine';

/**
 * Builds a `.segment { padding ...; margin: -... }` CSS rule that
 * grows the border-box by the given per-side lengths and cancels
 * the layout shift with a matching negative margin. Returns an
 * empty string for `null` input.
 */
export class SegmentPaddingCssRuleBuilder {

  build(padding: BoxEdges | null): string {
    if (padding === null) return '';
    const positive = `${padding.top} ${padding.right} ${padding.bottom} ${padding.left}`;
    const negative = [padding.top, padding.right, padding.bottom, padding.left]
      .map((length) => this.negate(length))
      .join(' ');
    return `.segment { padding: ${positive}; margin: ${negative}; }`;
  }

  private negate(length: string): string {
    if (this.isZero(length)) return length;
    if (length.startsWith('-')) return length.slice(1);
    return `-${length}`;
  }

  private isZero(length: string): boolean {
    return /^-?0(?:\.0+)?[a-z%]*$/i.test(length);
  }
}

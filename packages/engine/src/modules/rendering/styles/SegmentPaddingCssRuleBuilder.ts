import type { BoxEdges } from '@modules/rendering/types/BoxEdges';
import { CssVariable } from '@modules/document/CssVariable';

/**
 * Builds the engine-internal CSS rule that applies per-side padding
 * to `.segment`, cancels its layout shift with a matching negative
 * margin, and exposes the vertical padding amounts on CSS variables
 * the decoration containers read to anchor themselves at the content
 * edge rather than the padded edge. Returns an empty string for
 * `null` input.
 */
export class SegmentPaddingCssRuleBuilder {

  build(padding: BoxEdges | null): string {
    if (padding === null) return '';
    const positive = `${padding.top} ${padding.right} ${padding.bottom} ${padding.left}`;
    const negative = [padding.top, padding.right, padding.bottom, padding.left]
      .map((length) => this.negate(length))
      .join(' ');
    const internalVars =
      `${CssVariable.SEGMENT_PADDING_TOP}: ${padding.top}; ` +
      `${CssVariable.SEGMENT_PADDING_BOTTOM}: ${padding.bottom};`;
    return `.segment { padding: ${positive}; margin: ${negative}; ${internalVars} }`;
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

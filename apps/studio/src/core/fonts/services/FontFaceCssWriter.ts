import type { FontFaceDeclaration } from '@core/fonts/domain/FontFaceDeclaration';
import type { FontMetrics } from '@core/fonts/domain/FontMetrics';
import type { FontFaceSourceTrimmer } from '@core/fonts/services/FontFaceSourceTrimmer';

/**
 * Writes a `@font-face` declaration back out as CSS, dropping the
 * sources not worth embedding on the way.
 *
 * The family name is quoted: one holding a token that is not a valid CSS
 * identifier — `Press Start 2P`, whose `2P` opens with a digit —
 * invalidates the whole descriptor unquoted, and the browser then
 * registers nothing and falls back silently.
 */
export class FontFaceCssWriter {

  constructor(private readonly sourceTrimmer: FontFaceSourceTrimmer) {}

  write(declaration: FontFaceDeclaration): string {
    const parts = [`font-family:'${declaration.family}'`];
    for (const [name, value] of declaration.descriptors) parts.push(`${name}:${value}`);
    parts.push(`src:${this.sourceTrimmer.trim(declaration.source)}`);
    if (declaration.unicodeRange) parts.push(`unicode-range:${declaration.unicodeRange}`);
    if (declaration.metrics !== null) parts.push(...this.metricDescriptors(declaration.metrics));
    return `@font-face{${parts.join(';')}}`;
  }

  /**
   * The line gap goes to zero because the ascent and descent given are
   * the whole box: a gap left in place would be added on top of them and
   * open the line further than the face that was measured.
   */
  private metricDescriptors(metrics: FontMetrics): string[] {
    return [
      `ascent-override:${this.asPercentage(metrics.ascent)}`,
      `descent-override:${this.asPercentage(metrics.descent)}`,
      'line-gap-override:0%',
    ];
  }

  private asPercentage(fraction: number): string {
    return `${(fraction * 100).toFixed(3).replace(/\.?0+$/, '')}%`;
  }
}

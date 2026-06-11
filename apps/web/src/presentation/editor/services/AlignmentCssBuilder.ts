import type { AlignmentConfig } from '@tscaps/engine';
import { CssVariable } from '@tscaps/engine';

export interface AnchorStyle {
  readonly top: string;
  readonly left: string;
  readonly alignItems: 'start' | 'center' | 'end';
  readonly justifyItems: 'start' | 'center' | 'end';
}

/**
 * Builds the CSS the overlay needs from a sheet's effective alignment:
 * the inline style for the zero-sized anchor element, and the CSS
 * variables that drive the video-frame layer. Stateless derivation —
 * no DOM access, no observable side effects.
 */
export class AlignmentCssBuilder {
  /**
   * Inline style for the zero-sized anchor element that places its
   * single grid child (the wrapper) at the anchor point with the right
   * edge pinned. Matches the engine's export-side anchor exactly.
   */
  buildAnchorStyle(alignment: AlignmentConfig): AnchorStyle {
    return {
      top: `${alignment.verticalOffset * 100}%`,
      left: `${alignment.horizontalOffset * 100}%`,
      alignItems: this.flexAlignmentFor(alignment.verticalAlign, 'top'),
      justifyItems: this.flexAlignmentFor(alignment.horizontalAlign, 'left'),
    };
  }

  /**
   * CSS variables that size and position the video-frame layer so it
   * spans the full video viewport. Computed against the consuming
   * subtree's effective alignment so the layer stays in sync when a
   * segment or word is re-anchored away from the sheet's default.
   */
  buildSubtitleRegionVars(alignment: AlignmentConfig): Record<string, string> {
    const verticalAnchorPercent = this.anchorPercentFor(alignment.verticalAlign, 'top');
    const horizontalAnchorPercent = this.anchorPercentFor(alignment.horizontalAlign, 'left');
    return {
      [CssVariable.SUBTITLE_REGION_WIDTH]: '100cqw',
      [CssVariable.SUBTITLE_REGION_HEIGHT]: '100cqh',
      [CssVariable.SUBTITLE_REGION_X]: `calc(${horizontalAnchorPercent}% - ${alignment.horizontalOffset * 100}cqw)`,
      [CssVariable.SUBTITLE_REGION_Y]: `calc(${verticalAnchorPercent}% - ${alignment.verticalOffset * 100}cqh)`,
    };
  }

  private flexAlignmentFor(align: string, startKeyword: string): 'start' | 'center' | 'end' {
    if (align === startKeyword) return 'start';
    if (align === 'center') return 'center';
    return 'end';
  }

  private anchorPercentFor(align: string, startKeyword: string): number {
    if (align === startKeyword) return 0;
    if (align === 'center') return 50;
    return 100;
  }
}

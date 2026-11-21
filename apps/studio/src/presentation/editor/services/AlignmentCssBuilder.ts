import type { AlignmentConfig, TextDirection } from '@tscaps/engine';
import type { HorizontalPlacement, HorizontalPlacementResolver } from '@tscaps/engine/advanced';
import { CssVariable } from '@tscaps/engine';

export interface AnchorStyle {
  readonly top: string;
  readonly left: string;
  readonly alignItems: 'start' | 'center' | 'end';
  readonly justifyItems: 'start' | 'center' | 'end';
  readonly [cssCustomProperty: `--${string}`]: string | number | undefined;
}

/**
 * Builds the CSS the overlay needs from a sheet's effective alignment:
 * the inline style for the zero-sized anchor element, and the CSS
 * variables that drive the video-frame layer. Stateless derivation —
 * no DOM access, no observable side effects.
 *
 * A caption's horizontal anchor may be stated in reading terms, so every
 * call takes the direction the caption reads in and answers in screen
 * terms.
 */
export class AlignmentCssBuilder {

  constructor(private readonly horizontalPlacementResolver: HorizontalPlacementResolver) {}

  /**
   * Inline style for the zero-sized anchor element that places its
   * single grid child (the wrapper) at the anchor point with the right
   * edge pinned. Matches the engine's export-side anchor exactly.
   */
  buildAnchorStyle(alignment: AlignmentConfig, textDirection: TextDirection): AnchorStyle {
    return {
      top: `${alignment.verticalOffset * 100}%`,
      left: `${this.horizontalOffsetFromLeft(alignment, textDirection) * 100}%`,
      alignItems: this.gridAlignmentFor(this.verticalAnchorPercent(alignment)),
      justifyItems: this.gridAlignmentFor(this.horizontalAnchorPercent(alignment, textDirection)),
    };
  }

  /**
   * CSS variables that size and position the video-frame layer so it
   * spans the full video viewport. Computed against the consuming
   * subtree's effective alignment so the layer stays in sync when a
   * segment or word is re-anchored away from the sheet's default.
   */
  buildSubtitleRegionVars(alignment: AlignmentConfig, textDirection: TextDirection): Record<string, string> {
    const horizontalAnchorPercent = this.horizontalAnchorPercent(alignment, textDirection);
    const horizontalOffsetPercent = this.horizontalOffsetFromLeft(alignment, textDirection) * 100;
    return {
      [CssVariable.SUBTITLE_REGION_WIDTH]: '100cqw',
      [CssVariable.SUBTITLE_REGION_HEIGHT]: '100cqh',
      [CssVariable.SUBTITLE_REGION_X]: `calc(${horizontalAnchorPercent}% - ${horizontalOffsetPercent}cqw)`,
      [CssVariable.SUBTITLE_REGION_Y]: `calc(${this.verticalAnchorPercent(alignment)}% - ${alignment.verticalOffset * 100}cqh)`,
    };
  }

  /**
   * CSS variables naming where the caption's vertical anchor landed and
   * which part of the box was placed on it, so a stylesheet can express
   * a position against the frame instead of against the anchor.
   * Mirrors the engine's export-side pair exactly.
   */
  buildAnchorVars(alignment: AlignmentConfig): Record<string, string> {
    return {
      [CssVariable.SEGMENT_ANCHOR_Y]: String(alignment.verticalOffset),
      [CssVariable.SEGMENT_ANCHOR_ORIGIN_Y]: `${this.verticalAnchorPercent(alignment)}%`,
    };
  }

  private horizontalOffsetFromLeft(alignment: AlignmentConfig, textDirection: TextDirection): number {
    return this.resolveHorizontal(alignment, textDirection).offsetFromLeft;
  }

  private horizontalAnchorPercent(alignment: AlignmentConfig, textDirection: TextDirection): number {
    const { side } = this.resolveHorizontal(alignment, textDirection);
    if (side === 'left') return 0;
    return side === 'center' ? 50 : 100;
  }

  private resolveHorizontal(alignment: AlignmentConfig, textDirection: TextDirection): HorizontalPlacement {
    return this.horizontalPlacementResolver.resolve(
      alignment.horizontalAlign,
      alignment.horizontalOffset,
      textDirection,
    );
  }

  private verticalAnchorPercent(alignment: AlignmentConfig): number {
    if (alignment.verticalAlign === 'top') return 0;
    return alignment.verticalAlign === 'center' ? 50 : 100;
  }

  private gridAlignmentFor(anchorPercent: number): 'start' | 'center' | 'end' {
    if (anchorPercent === 0) return 'start';
    return anchorPercent === 50 ? 'center' : 'end';
  }
}

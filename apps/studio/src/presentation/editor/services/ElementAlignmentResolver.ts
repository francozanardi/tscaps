import type { AlignmentConfig, PhysicalSide, TextDirection, VerticalAlign } from '@tscaps/engine';
import type { HorizontalPlacementResolver } from '@tscaps/engine/advanced';
import type { Sheet } from '@core/sheets/domain/Sheet';
import type { ElementPlacement } from '@core/elements/domain/ElementPlacement';
import type { ElementStyles } from '@core/elements/domain/ElementStyles';

/** A complete position: both anchors, in screen terms, and the offsets they place. */
export interface ElementPositionBaseline {
  readonly verticalAlign: VerticalAlign;
  readonly verticalOffset: number;
  readonly horizontalAlign: PhysicalSide;
  readonly horizontalOffset: number;
}

/** Composes where an element is actually anchored: what the sheet says, with whatever the user put over it. */
export class ElementAlignmentResolver {

  constructor(private readonly horizontalPlacementResolver: HorizontalPlacementResolver) {}

  /** Sheet alignment, replaced by the segment's own placement when it has one. */
  segmentEffectiveAlignment(sheet: Sheet, segmentId: string, elementStyles: ElementStyles): AlignmentConfig {
    return this.merged(sheet.alignmentConfig, elementStyles.placementOf(segmentId));
  }

  /** Segment alignment, replaced by the word's own placement when it has one. */
  wordEffectiveAlignment(segmentAlignment: AlignmentConfig, elementStyles: ElementStyles, wordId: string): AlignmentConfig {
    return this.merged(segmentAlignment, elementStyles.placementOf(wordId));
  }

  /**
   * Position the element's sliders start from: where it is measured to
   * sit when it is in the live preview, and the inherited alignment when
   * it is not. Answered in screen terms either way, so the number a
   * slider shows is the number a commit stores.
   */
  positionBaseline(
    alignment: AlignmentConfig,
    textDirection: TextDirection,
    measured: ElementPositionBaseline | null,
  ): ElementPositionBaseline {
    if (measured) return measured;
    const placement = this.horizontalPlacementResolver.resolve(
      alignment.horizontalAlign,
      alignment.horizontalOffset,
      textDirection,
    );
    return {
      verticalAlign: alignment.verticalAlign,
      verticalOffset: alignment.verticalOffset,
      horizontalAlign: placement.side,
      horizontalOffset: placement.offsetFromLeft,
    };
  }

  private merged(inherited: AlignmentConfig, placement: ElementPlacement | null): AlignmentConfig {
    return placement ? { ...inherited, ...placement } : inherited;
  }
}

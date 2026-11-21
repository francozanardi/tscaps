import type { AlignmentConfig, PhysicalSide, TextDirection, VerticalAlign } from '@tscaps/engine';
import type { HorizontalPlacementResolver } from '@tscaps/engine/advanced';

/** Width and height of a box, in pixels. */
export interface BoxSize {
  readonly width: number;
  readonly height: number;
}

/** A box's top-left corner, in pixels from the frame's top-left. */
export interface BoxOrigin {
  readonly left: number;
  readonly top: number;
}

/** Pixels a box travels between two placements. */
export interface BoxShift {
  readonly deltaX: number;
  readonly deltaY: number;
}

/**
 * Resolves where an aligned caption box lands inside the video frame, in
 * pixels. The pixel counterpart of `AlignmentCssBuilder`: an alignment
 * names an anchor point as a fraction of the frame, and the anchor pins
 * the box's near edge, its centre, or its far edge to that point.
 *
 * Every `box` is the caption's layout box — the box the anchor's grid
 * places, before rotation or the behind-actor lift. A measured client
 * rect carries both transforms and would land the answer off by them.
 *
 * A caption's horizontal anchor may be stated in reading terms, so every
 * call takes the direction the caption reads in and answers in screen
 * terms. Pure: no DOM access, no state.
 */
export class AlignmentGeometryResolver {

  constructor(private readonly horizontalPlacementResolver: HorizontalPlacementResolver) {}

  origin(alignment: AlignmentConfig, box: BoxSize, frame: BoxSize, textDirection: TextDirection): BoxOrigin {
    const horizontal = this.horizontalPlacementResolver.resolve(
      alignment.horizontalAlign,
      alignment.horizontalOffset,
      textDirection,
    );
    return {
      left: horizontal.offsetFromLeft * frame.width - this.pinnedFractionOf(horizontal.side) * box.width,
      top: alignment.verticalOffset * frame.height - this.pinnedFractionOf(alignment.verticalAlign) * box.height,
    };
  }

  /**
   * Pixels a box of unchanged size travels when its effective alignment
   * goes from `from` to `to`. Zero on both axes when the two alignments
   * place the box identically.
   */
  shift(
    from: AlignmentConfig,
    to: AlignmentConfig,
    box: BoxSize,
    frame: BoxSize,
    textDirection: TextDirection,
  ): BoxShift {
    const before = this.origin(from, box, frame, textDirection);
    const after = this.origin(to, box, frame, textDirection);
    return { deltaX: after.left - before.left, deltaY: after.top - before.top };
  }

  // How far into the box the anchor point sits: the near edge, the
  // centre, or the far edge.
  private pinnedFractionOf(side: PhysicalSide | VerticalAlign): number {
    if (side === 'left' || side === 'top') return 0;
    return side === 'center' ? 0.5 : 1;
  }
}

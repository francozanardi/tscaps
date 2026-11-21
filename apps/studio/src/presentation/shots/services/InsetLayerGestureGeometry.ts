import type { FootageRect } from '@tscaps/engine/advanced';
import type { VideoLayout } from '@core/editor/domain/VideoState';
import type { InsetShotLayerPlacement } from '@core/shots/domain/ShotLayerPlacement';
import { SHOT_LAYER_PLACEMENT_RANGES } from '@core/shots/domain/ShotLayerPlacementRanges';
import type { ResizeCorner } from '@presentation/editor/services/ResizeGeometryResolver';
import type { SnapBand } from '@presentation/editor/services/SnapZoneResolver';

/** A box over the video as it stood when a gesture on it began. */
export interface InsetLayerGestureStart {
  /** The layout its fields hold. */
  readonly placement: InsetShotLayerPlacement;
  /** Where it rests, normalized to the frame on each axis. */
  readonly rect: FootageRect;
  /** The video's size, or null while not known. */
  readonly frame: VideoLayout | null;
}

/** A length on each normalized axis. */
interface AxisLengths {
  readonly x: number;
  readonly y: number;
}

/** Where a gesture puts the box, and whether its centre was pulled onto the frame's centre lines. */
export interface InsetLayerGestureResult {
  readonly placement: InsetShotLayerPlacement;
  readonly snappedToVerticalCentre: boolean;
  readonly snappedToHorizontalCentre: boolean;
}

/** The two centre lines a moved box's centre is pulled onto. */
export interface InsetLayerSnapLines {
  /** Pulls the centre's x, on the line down the middle of the frame. */
  readonly vertical: SnapBand;
  /** Pulls the centre's y, on the line across the middle of the frame. */
  readonly horizontal: SnapBand;
}

/**
 * Turns a pointer dragging a box over the video into the placement it
 * leaves behind: a press inside the box moves it, a press on a corner
 * resizes it from the opposite corner, which stays where it is.
 *
 * The box keeps its shape through a resize: its placement's aspect
 * ratio is never touched, so only its width changes and its height
 * follows. A moved box's centre is pulled onto the frame's centre
 * lines when it comes close, the way a caption's is.
 *
 * Every answer keeps the box inside the padding at the size it is
 * drawn: a box moved across the padding stops at it, and one grown past
 * it stops growing. So what is stored is where the box is drawn, and
 * the next gesture starts from what is on screen rather than from a
 * value nobody can see. Measured on the box where it rests, never
 * reasoned from its settings, so the answer holds whatever the layer's
 * CSS made of them.
 */
export class InsetLayerGestureGeometry {
  constructor(private readonly snapLines: InsetLayerSnapLines) {}

  /** The box moved by `dx` / `dy`, fractions of the frame's width and height. */
  moved(start: InsetLayerGestureStart, dx: number, dy: number): InsetLayerGestureResult {
    const centreX = start.rect.x + start.rect.width / 2 + dx;
    const centreY = start.rect.y + start.rect.height / 2 + dy;
    const snappedToVerticalCentre = this.pulls(this.snapLines.vertical, centreX);
    const snappedToHorizontalCentre = this.pulls(this.snapLines.horizontal, centreY);
    const padding = this.paddingOf(start);
    const placement = {
      ...start.placement,
      width: start.rect.width,
      centerX: this.insidePadding(snappedToVerticalCentre ? this.snapLines.vertical.center : centreX, start.rect.width, padding.x),
      centerY: this.insidePadding(snappedToHorizontalCentre ? this.snapLines.horizontal.center : centreY, start.rect.height, padding.y),
    };
    return { placement, snappedToVerticalCentre, snappedToHorizontalCentre };
  }

  /**
   * The box resized by dragging `corner` to the pointer at `pointerX` /
   * `pointerY`, fractions of the frame. The box grows by whichever axis
   * the pointer reaches further along, so the corner never runs ahead
   * of it, and stops at the width range a placement may hold and at the
   * padding.
   */
  resized(start: InsetLayerGestureStart, corner: ResizeCorner, pointerX: number, pointerY: number): InsetLayerGestureResult {
    const { rect } = start;
    const growsRight = corner === 'tr' || corner === 'br';
    const growsDown = corner === 'bl' || corner === 'br';
    const anchorX = growsRight ? rect.x : rect.x + rect.width;
    const anchorY = growsDown ? rect.y : rect.y + rect.height;
    const reachX = Math.max(0, growsRight ? pointerX - anchorX : anchorX - pointerX);
    const reachY = Math.max(0, growsDown ? pointerY - anchorY : anchorY - pointerY);
    const scale = Math.max(reachX / rect.width, reachY / rect.height);
    const padding = this.paddingOf(start);
    const roomX = growsRight ? 1 - padding.x - anchorX : anchorX - padding.x;
    const roomY = growsDown ? 1 - padding.y - anchorY : anchorY - padding.y;
    const widthThatFits = Math.min(roomX, (roomY * rect.width) / rect.height);
    const width = Math.min(this.clampWidth(rect.width * scale), Math.max(widthThatFits, 0));
    const height = rect.height * (width / rect.width);
    const placement = {
      ...start.placement,
      width,
      centerX: growsRight ? anchorX + width / 2 : anchorX - width / 2,
      centerY: growsDown ? anchorY + height / 2 : anchorY - height / 2,
    };
    return { placement, snappedToVerticalCentre: false, snappedToHorizontalCentre: false };
  }

  /** The padding on each normalized axis: a share of the frame's shorter side, which is a different share of each. */
  private paddingOf(start: InsetLayerGestureStart): AxisLengths {
    const width = start.frame !== null && start.frame.width > 0 ? start.frame.width : 1;
    const height = start.frame !== null && start.frame.height > 0 ? start.frame.height : 1;
    const shorterSide = Math.min(width, height);
    return { x: (start.placement.padding * shorterSide) / width, y: (start.placement.padding * shorterSide) / height };
  }

  /** A centre on one axis moved back so a box `length` long around it stays inside `padding`. */
  private insidePadding(centre: number, length: number, padding: number): number {
    const least = padding + length / 2;
    const most = 1 - padding - length / 2;
    return Math.max(least, Math.min(most, centre));
  }


  private pulls(band: SnapBand, centre: number): boolean {
    return Math.abs(centre - band.center) <= band.radius;
  }

  private clampWidth(width: number): number {
    const { min, max } = SHOT_LAYER_PLACEMENT_RANGES.insetWidth;
    return Math.min(max, Math.max(min, width));
  }
}

import type { PhysicalSide, VerticalAlign } from '@tscaps/engine';

// Snap bands are positions on the frame, so this axis stays in screen terms.
// Callers restate the answer in reading terms before it becomes stored state.
type HorizontalAlign = PhysicalSide;

export interface SnapBand {
  /** Fraction of frame where the band's canonical snap target sits. */
  readonly center: number;
  /** Half-width of the snap radius around `center`, in frame fractions. */
  readonly radius: number;
}

interface VerticalBand extends SnapBand {
  readonly align: VerticalAlign;
}

interface HorizontalBand extends SnapBand {
  readonly align: HorizontalAlign;
}

export interface VerticalResolution {
  readonly align: VerticalAlign;
  readonly offset: number;
  readonly snapped: boolean;
  /** When snapped, the `center` of the band; otherwise null. */
  readonly snappedBandCenter: number | null;
}

export interface HorizontalResolution {
  readonly align: HorizontalAlign;
  readonly offset: number;
  readonly snapped: boolean;
  readonly snappedBandCenter: number | null;
}

export interface AlignmentResolution {
  readonly vertical: VerticalResolution;
  readonly horizontal: HorizontalResolution;
}

/** The anchor a drag keeps on each axis; `null` leaves that axis free to take the one its tercio names. */
export interface HeldAnchors {
  readonly vertical: VerticalAlign | null;
  readonly horizontal: HorizontalAlign | null;
}

const NOTHING_HELD: HeldAnchors = { vertical: null, horizontal: null };

export interface WordOffsetResolution {
  readonly verticalOffset: number;
  readonly horizontalOffset: number;
  readonly horizontalSnap: boolean;
}

/** Size of a box as fractions of the video frame. */
export interface BoxExtent {
  readonly widthFrac: number;
  readonly heightFrac: number;
}

/** The bands a box of a given size can be snapped to, per axis. */
export interface SnapBandsInFrame {
  readonly vertical: readonly SnapBand[];
  readonly horizontal: readonly SnapBand[];
}

/**
 * Maps a box's centroid position (as fractions of the video frame) to
 * an `AlignmentConfig`. A band is a line on the frame that the box's
 * *anchored edge* sticks to — the edge, or the centre, that the band's
 * anchor pins. Inside a band's radius we emit the band's anchor and its
 * canonical offset, so the edge lands exactly on the line the overlay
 * draws as a guide. Outside every band we pick the anchor by the
 * centroid's tercio and back-compute the offset so the box stays
 * visually at the same place across the anchor change. Pure: no DOM
 * access, no state.
 *
 * A band's pull is therefore measured on the anchored edge, never on the
 * centroid. Measuring it on the centroid makes the two ends disagree,
 * and the disagreement is the box's own half-size: vertically the snap
 * fires half a caption early and then shoves the box that far from the
 * cursor, and horizontally the side bands stop being reachable at all,
 * because a box wider than a band's margin cannot bring its centroid
 * that close to the frame's edge.
 *
 * That half-size also decides *which* bands a box has: measured on the
 * edge, a side band's target sits half a box from the centre band's, so
 * a box wide enough closes that distance and the two stop naming
 * different places — past it the side target crosses to the wrong half
 * of the frame outright, and "left" starts pulling rightwards. A band
 * whose pull overlaps the centre's is not offered to that box, which is
 * why the applicable set has to be asked for with a size → `bandsFor`.
 *
 * An offset is a point on the frame, so a box travels as far as its
 * anchor can still name one: past the tercio's anchor the box's own
 * centre takes over, and the centroid itself stops at the frame's edge.
 * A caption can therefore hang half out of frame on any side and never
 * further — the limit words have always had, their anchor being their
 * centre.
 *
 * Vertical bands sit at top/center/bottom safe-zones tuned for short-form
 * video; horizontal bands at left/center/right with a slightly wider
 * center radius reflecting the design pull toward horizontal centering.
 */
export class SnapZoneResolver {
  private readonly verticalBands: readonly VerticalBand[] = [
    { center: 0.12, radius: 0.02, align: 'top' },
    { center: 0.5,  radius: 0.02, align: 'center' },
    { center: 0.88, radius: 0.02, align: 'bottom' },
  ];

  private readonly horizontalBands: readonly HorizontalBand[] = [
    { center: 0.06, radius: 0.02, align: 'left' },
    { center: 0.5,  radius: 0.025, align: 'center' },
    { center: 0.94, radius: 0.02, align: 'right' },
  ];

  /**
   * Resolves a centroid into an anchor and an offset per axis.
   *
   * An axis `held` names keeps that anchor: it comes in and is never
   * replaced. Bands pull the box's anchored edge the same way they do
   * when the anchor is free, so a box dragged against a held anchor
   * still lands on the same guide lines everything else snaps to.
   * Unsnapped, the returned offset is back-computed for the held anchor
   * so the box stays visually at the centroid.
   *
   * Reach is the price of keeping an anchor: with no anchor to fall back
   * to, the box stops where its anchor point reaches the frame's edge
   * rather than where its centre does.
   */
  resolve(
    centroidXFrac: number,
    centroidYFrac: number,
    boxWidthFrac: number,
    boxHeightFrac: number,
    held: HeldAnchors = NOTHING_HELD,
  ): AlignmentResolution {
    const vertical = held.vertical
      ? this.resolveVerticalAtAnchor(held.vertical, centroidYFrac, boxHeightFrac)
      : this.resolveVertical(centroidYFrac, boxHeightFrac);
    const horizontal = held.horizontal
      ? this.resolveHorizontalAtAnchor(held.horizontal, centroidXFrac, boxWidthFrac)
      : this.resolveHorizontal(centroidXFrac, boxWidthFrac);
    return { vertical, horizontal };
  }

  /**
   * Word-flavored resolution. A word drag pins its anchor to
   * `center`/`center` on commit, so the offsets returned here are the
   * centroid position itself (offset = where the word's center lands).
   * Vertical is fully free; horizontal snaps to the frame's center
   * band — the only weighted guide for words.
   */
  resolveWord(centroidXFrac: number, centroidYFrac: number): WordOffsetResolution {
    const verticalOffset = this.clamp01(centroidYFrac);
    const center = this.horizontalCenterBand();
    const horizontalSnap = Math.abs(centroidXFrac - center.center) <= center.radius;
    const horizontalOffset = horizontalSnap ? center.center : this.clamp01(centroidXFrac);
    return { verticalOffset, horizontalOffset, horizontalSnap };
  }

  /**
   * The bands a box of size `box` can actually be snapped to — the ones
   * whose pull it can tell apart from the centre band's. Callers draw a
   * guide per returned band: a line the box cannot land on is a line
   * that must not be on screen.
   */
  bandsFor(box: BoxExtent): SnapBandsInFrame {
    return {
      vertical: this.applicableVerticalBands(box.heightFrac),
      horizontal: this.applicableHorizontalBands(box.widthFrac),
    };
  }

  horizontalCenterBand(): SnapBand {
    return this.centerBandOf(this.horizontalBands);
  }

  private resolveVertical(centroidFrac: number, boxHeightFrac: number): VerticalResolution {
    const centroid = this.clamp01(centroidFrac);
    const pulling = this.applicableVerticalBands(boxHeightFrac).find(
      (band) => this.pulls(band, this.verticalOffsetFor(band.align, centroid, boxHeightFrac)),
    );
    if (pulling) {
      return { align: pulling.align, offset: pulling.center, snapped: true, snappedBandCenter: pulling.center };
    }
    const align = this.verticalAnchorFor(centroid, boxHeightFrac);
    const offset = this.verticalOffsetFor(align, centroid, boxHeightFrac);
    return { align, offset, snapped: false, snappedBandCenter: null };
  }

  private resolveHorizontal(centroidFrac: number, boxWidthFrac: number): HorizontalResolution {
    const centroid = this.clamp01(centroidFrac);
    const pulling = this.applicableHorizontalBands(boxWidthFrac).find(
      (band) => this.pulls(band, this.horizontalOffsetFor(band.align, centroid, boxWidthFrac)),
    );
    if (pulling) {
      return { align: pulling.align, offset: pulling.center, snapped: true, snappedBandCenter: pulling.center };
    }
    const align = this.horizontalAnchorFor(centroid, boxWidthFrac);
    const offset = this.horizontalOffsetFor(align, centroid, boxWidthFrac);
    return { align, offset, snapped: false, snappedBandCenter: null };
  }

  private resolveVerticalAtAnchor(
    align: VerticalAlign,
    centroidFrac: number,
    boxHeightFrac: number,
  ): VerticalResolution {
    const offset = this.clamp01(this.verticalOffsetFor(align, this.clamp01(centroidFrac), boxHeightFrac));
    const pulling = this.applicableVerticalBands(boxHeightFrac).find((band) => this.pulls(band, offset));
    if (pulling) {
      return { align, offset: pulling.center, snapped: true, snappedBandCenter: pulling.center };
    }
    return { align, offset, snapped: false, snappedBandCenter: null };
  }

  private resolveHorizontalAtAnchor(
    align: HorizontalAlign,
    centroidFrac: number,
    boxWidthFrac: number,
  ): HorizontalResolution {
    const offset = this.clamp01(this.horizontalOffsetFor(align, this.clamp01(centroidFrac), boxWidthFrac));
    const pulling = this.applicableHorizontalBands(boxWidthFrac).find((band) => this.pulls(band, offset));
    if (pulling) {
      return { align, offset: pulling.center, snapped: true, snappedBandCenter: pulling.center };
    }
    return { align, offset, snapped: false, snappedBandCenter: null };
  }

  private applicableVerticalBands(boxHeightFrac: number): readonly VerticalBand[] {
    const center = this.centerBandOf(this.verticalBands);
    return this.verticalBands.filter(
      (band) => band === center || this.separatedFromCenter(band, band.align, center, boxHeightFrac),
    );
  }

  private applicableHorizontalBands(boxWidthFrac: number): readonly HorizontalBand[] {
    const center = this.centerBandOf(this.horizontalBands);
    return this.horizontalBands.filter(
      (band) => band === center || this.separatedFromCenter(band, band.align, center, boxWidthFrac),
    );
  }

  // Two bands whose pulls overlap describe one place, and which of them
  // answers for it would come down to their declaration order.
  private separatedFromCenter(
    band: SnapBand,
    align: VerticalAlign | HorizontalAlign,
    center: SnapBand,
    boxExtentFrac: number,
  ): boolean {
    return this.gapToCenter(band, align, center, boxExtentFrac) > band.radius + center.radius;
  }

  // Distance between where a band puts the box's centroid and where the
  // centre band does, measured toward the centre: a band's pull is
  // stated on the anchored edge, which sits half a box from the
  // centroid, so a big enough box walks the target past the middle of
  // the frame and the gap turns negative.
  private gapToCenter(
    band: SnapBand,
    align: VerticalAlign | HorizontalAlign,
    center: SnapBand,
    boxExtentFrac: number,
  ): number {
    const halfBox = boxExtentFrac / 2;
    if (align === 'top' || align === 'left') return center.center - (band.center + halfBox);
    return band.center - halfBox - center.center;
  }

  private centerBandOf<T extends SnapBand & { align: VerticalAlign | HorizontalAlign }>(bands: readonly T[]): T {
    const band = bands.find((b) => b.align === 'center');
    if (!band) throw new Error('Snap configuration must include a center band on both axes');
    return band;
  }

  /** Whether an anchored edge sitting at `offset` falls inside the band's pull. */
  private pulls(band: SnapBand, offset: number): boolean {
    return Math.abs(offset - band.center) <= band.radius;
  }

  // The tercio names the anchor while it can: once the box has
  // travelled far enough that its anchored edge leaves the frame, that
  // anchor no longer names a point on it, and the box's own centre —
  // which a centroid inside the frame always does — takes over.
  private verticalAnchorFor(centroidFrac: number, boxHeightFrac: number): VerticalAlign {
    const tercio = this.tercioForY(centroidFrac);
    return this.onFrame(this.verticalOffsetFor(tercio, centroidFrac, boxHeightFrac)) ? tercio : 'center';
  }

  private horizontalAnchorFor(centroidFrac: number, boxWidthFrac: number): HorizontalAlign {
    const tercio = this.tercioForX(centroidFrac);
    return this.onFrame(this.horizontalOffsetFor(tercio, centroidFrac, boxWidthFrac)) ? tercio : 'center';
  }

  private tercioForY(c: number): VerticalAlign {
    if (c < 1 / 3) return 'top';
    if (c < 2 / 3) return 'center';
    return 'bottom';
  }

  private tercioForX(c: number): HorizontalAlign {
    if (c < 1 / 3) return 'left';
    if (c < 2 / 3) return 'center';
    return 'right';
  }

  private verticalOffsetFor(align: VerticalAlign, centroidFrac: number, boxHeightFrac: number): number {
    if (align === 'top') return centroidFrac - boxHeightFrac / 2;
    if (align === 'center') return centroidFrac;
    return centroidFrac + boxHeightFrac / 2;
  }

  private horizontalOffsetFor(align: HorizontalAlign, centroidFrac: number, boxWidthFrac: number): number {
    if (align === 'left') return centroidFrac - boxWidthFrac / 2;
    if (align === 'center') return centroidFrac;
    return centroidFrac + boxWidthFrac / 2;
  }

  private onFrame(offset: number): boolean {
    return offset >= 0 && offset <= 1;
  }

  private clamp01(v: number): number {
    return Math.max(0, Math.min(1, v));
  }
}

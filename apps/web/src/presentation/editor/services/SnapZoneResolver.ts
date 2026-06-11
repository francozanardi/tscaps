import type { AlignmentConfig, VerticalAlign } from '@tscaps/engine';

type HorizontalAlign = AlignmentConfig['horizontalAlign'];

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
  readonly alignment: AlignmentConfig;
  readonly vertical: VerticalResolution;
  readonly horizontal: HorizontalResolution;
}

export interface WordOffsetResolution {
  readonly verticalOffset: number;
  readonly horizontalOffset: number;
  readonly horizontalSnap: boolean;
}

/**
 * Maps a box's centroid position (as fractions of the video frame) to
 * an `AlignmentConfig`. Inside a band's snap radius we emit the band's
 * canonical anchor + offset (an intentional pop). Outside any band we
 * pick the anchor by the centroid's tercio and back-compute the offset
 * so the box stays visually at the same place across the anchor
 * change. Pure: no DOM access, no state.
 *
 * Vertical bands sit at top/center/bottom safe-zones tuned for short-form
 * video; horizontal bands at left/center/right with a slightly wider
 * center radius reflecting the design pull toward horizontal centering.
 */
export class SnapZoneResolver {
  readonly verticalBands: readonly VerticalBand[] = [
    { center: 0.12, radius: 0.02, align: 'top' },
    { center: 0.5,  radius: 0.02, align: 'center' },
    { center: 0.88, radius: 0.02, align: 'bottom' },
  ];

  readonly horizontalBands: readonly HorizontalBand[] = [
    { center: 0.06, radius: 0.02, align: 'left' },
    { center: 0.5,  radius: 0.025, align: 'center' },
    { center: 0.94, radius: 0.02, align: 'right' },
  ];

  resolve(
    centroidXFrac: number,
    centroidYFrac: number,
    boxWidthFrac: number,
    boxHeightFrac: number,
  ): AlignmentResolution {
    const vertical = this.resolveVertical(centroidYFrac, boxHeightFrac);
    const horizontal = this.resolveHorizontal(centroidXFrac, boxWidthFrac);
    return {
      alignment: {
        verticalAlign: vertical.align,
        verticalOffset: vertical.offset,
        horizontalAlign: horizontal.align,
        horizontalOffset: horizontal.offset,
      },
      vertical,
      horizontal,
    };
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

  horizontalCenterBand(): SnapBand {
    const band = this.horizontalBands.find((b) => b.align === 'center');
    if (!band) throw new Error('Snap configuration must include a horizontal center band');
    return { center: band.center, radius: band.radius };
  }

  private resolveVertical(centroidFrac: number, boxHeightFrac: number): VerticalResolution {
    for (const band of this.verticalBands) {
      if (Math.abs(centroidFrac - band.center) <= band.radius) {
        return { align: band.align, offset: band.center, snapped: true, snappedBandCenter: band.center };
      }
    }
    const align = this.tercioForY(centroidFrac);
    const offset = this.verticalOffsetFor(align, centroidFrac, boxHeightFrac);
    return { align, offset, snapped: false, snappedBandCenter: null };
  }

  private resolveHorizontal(centroidFrac: number, boxWidthFrac: number): HorizontalResolution {
    for (const band of this.horizontalBands) {
      if (Math.abs(centroidFrac - band.center) <= band.radius) {
        return { align: band.align, offset: band.center, snapped: true, snappedBandCenter: band.center };
      }
    }
    const align = this.tercioForX(centroidFrac);
    const offset = this.horizontalOffsetFor(align, centroidFrac, boxWidthFrac);
    return { align, offset, snapped: false, snappedBandCenter: null };
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
    if (align === 'top') return this.clamp01(centroidFrac - boxHeightFrac / 2);
    if (align === 'center') return this.clamp01(centroidFrac);
    return this.clamp01(centroidFrac + boxHeightFrac / 2);
  }

  private horizontalOffsetFor(align: HorizontalAlign, centroidFrac: number, boxWidthFrac: number): number {
    if (align === 'left') return this.clamp01(centroidFrac - boxWidthFrac / 2);
    if (align === 'center') return this.clamp01(centroidFrac);
    return this.clamp01(centroidFrac + boxWidthFrac / 2);
  }

  private clamp01(v: number): number {
    return Math.max(0, Math.min(1, v));
  }
}

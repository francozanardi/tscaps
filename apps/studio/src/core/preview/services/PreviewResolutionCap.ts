export interface PreviewSize {
  readonly widthPx: number;
  readonly heightPx: number;
}

/**
 * Resolution policy for the in-browser preview pipeline. The
 * decoder sink and the destination canvas both size themselves
 * against the same cap so the painter performs a 1:1 copy and
 * source pixels above the cap never materialise downstream — on
 * 4K sources the cap is what keeps decoded frames out of the
 * JavaScript heap.
 *
 * The cap is enforced on the longest side; aspect ratio is
 * preserved, and source dimensions at or below the cap pass
 * through unchanged.
 */
export class PreviewResolutionCap {

  constructor(private readonly maxLongestSidePx: number) {}

  clamp(sourceWidthPx: number, sourceHeightPx: number): PreviewSize {
    const longest = Math.max(sourceWidthPx, sourceHeightPx);
    if (longest <= this.maxLongestSidePx) return { widthPx: sourceWidthPx, heightPx: sourceHeightPx };
    const scale = this.maxLongestSidePx / longest;
    return {
      widthPx: Math.round(sourceWidthPx * scale),
      heightPx: Math.round(sourceHeightPx * scale),
    };
  }
}

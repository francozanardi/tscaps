import type { VideoFrameRegion } from '@modules/rendering/VideoFrameSource';

/**
 * Anchor placement of a wrapper element within the viewport: the
 * absolute point its anchor edge lands on (in viewport pixels) and
 * which fraction of its own size aligns to that point.
 * `hAnchorPct` / `vAnchorPct` follow the `0`/`50`/`100` convention.
 */
export interface SegmentAnchorPlacement {
  readonly xPx: number;
  readonly yPx: number;
  readonly hAnchorPct: number;
  readonly vAnchorPct: number;
}

/**
 * Inputs that fully describe a single region-resolve request.
 */
export interface SegmentPaintRegionInput {
  /** HTML of the `wrapper → segment → …` subtree the consumer wants to measure. */
  readonly segmentHtml: string;
  /** DOM node the HTML is mounted into for layout — must have the consumer's stylesheet in effect. */
  readonly probeContainer: HTMLElement;
  /** Where the wrapper sits in the viewport. */
  readonly placement: SegmentAnchorPlacement;
  readonly viewportWidth: number;
  readonly viewportHeight: number;
  /** Extra room to leave around the painted box, in `em` (resolved against the segment's font size). */
  readonly safetyBleedEm: number;
}

/**
 * Computes the viewport-pixel sub-rectangle a rendered segment
 * subtree paints into. The consumer supplies the HTML, the
 * probe to mount it under, the wrapper's placement in the
 * viewport, and the safety-bleed policy; the resolver mounts,
 * reads the layout numbers, composes the rectangle, and unmounts.
 * Stateless — no caching, no consumer types crossed.
 */
export class SegmentPaintRegionResolver {

  resolve(input: SegmentPaintRegionInput): VideoFrameRegion {
    const host = document.createElement('div');
    host.style.cssText = `container-type: size; width: ${input.viewportWidth}px; height: ${input.viewportHeight}px;`;
    const inner = document.createElement('div');
    inner.style.cssText = 'display:inline-block;';
    inner.innerHTML = input.segmentHtml;
    host.appendChild(inner);
    input.probeContainer.appendChild(host);
    try {
      return this.composeRegion(inner, input);
    } finally {
      input.probeContainer.removeChild(host);
    }
  }

  private composeRegion(host: HTMLElement, input: SegmentPaintRegionInput): VideoFrameRegion {
    const wrapper = host.firstElementChild as HTMLElement;
    const segmentEl = wrapper.firstElementChild as HTMLElement;
    const computed = window.getComputedStyle(segmentEl);
    const fontSizePx = parseFloat(computed.fontSize) || 0;
    const safetyPx = fontSizePx * input.safetyBleedEm;

    const wrapperLeft = input.placement.xPx - wrapper.offsetWidth * input.placement.hAnchorPct / 100;
    const wrapperTop = input.placement.yPx - wrapper.offsetHeight * input.placement.vAnchorPct / 100;
    const segmentLeft = wrapperLeft + segmentEl.offsetLeft;
    const segmentTop = wrapperTop + segmentEl.offsetTop;

    const left = Math.max(0, Math.floor(segmentLeft - safetyPx));
    const top = Math.max(0, Math.floor(segmentTop - safetyPx));
    const right = Math.min(input.viewportWidth, Math.ceil(segmentLeft + segmentEl.offsetWidth + safetyPx));
    const bottom = Math.min(input.viewportHeight, Math.ceil(segmentTop + segmentEl.offsetHeight + safetyPx));
    return {
      x: left,
      y: top,
      width: Math.max(0, right - left),
      height: Math.max(0, bottom - top),
    };
  }
}

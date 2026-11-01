import { CaptionContentBoxMeasurer } from '@presentation/editor/services/CaptionContentBoxMeasurer';
import { CAPTION_ELEMENT_ID_ATTRIBUTE } from '@presentation/editor/services/CaptionElementAttribute';
import type { ChromeGeometry } from '@presentation/editor/services/OverlayChromeSource';
import { RenderedTransformResolver } from '@presentation/editor/services/RenderedTransformResolver';

const contentBoxMeasurer = new CaptionContentBoxMeasurer();
const transformResolver = new RenderedTransformResolver();

/**
 * Finds the rendered `.segment` of one segment under `scaler`.
 *
 * Matches on `.segment` rather than on the id attribute alone: the
 * scaler also carries the segment's hitzone ghost, which repeats
 * `data-tscaps-segment-id` so selection and the delegated drag start
 * resolve from it, and positioned word hosts repeat it too.
 *
 * Returns `null` while the segment is absent from the DOM — happens
 * briefly during re-derivation between renders.
 */
export function findSegmentElement(scaler: HTMLElement, segmentId: string): HTMLElement | null {
  return scaler.querySelector<HTMLElement>(`.segment[data-tscaps-segment-id="${CSS.escape(segmentId)}"]`);
}

/**
 * Reads the box the chrome around one caption should adopt, in
 * `scaler`-relative coordinates, inflated by a corona on each axis.
 *
 * The content box is a layout measurement, so the scale the caption is
 * painted with has to be put back into it: a segment mid-entrance is
 * drawn at a size its layout box never reports.
 */
export function measureSegmentChrome(
  segment: HTMLElement,
  scaler: HTMLElement,
  horizontalCoronaPx: number,
  verticalCoronaPx: number,
): ChromeGeometry {
  const content = contentBoxMeasurer.measure(segment, scaler);
  const rendered = transformResolver.resolve(segment, scaler);
  const width = content.width * rendered.scaleX + horizontalCoronaPx * 2;
  const height = content.height * rendered.scaleY + verticalCoronaPx * 2;
  return {
    left: content.left + content.width / 2 - width / 2,
    top: content.top + content.height / 2 - height / 2,
    width,
    height,
  };
}

/**
 * Finds one line of a rendered caption under `scaler`.
 *
 * Searched under the original `.segment` only, the one carrying
 * `data-tscaps-segment-id`: a copy laid over it for isolated elements,
 * and the mirror around a placed word, repeat the line's id on a
 * `.segment` that does not.
 *
 * Returns `null` while the line lays out no box — one whose words have
 * all left it renders no element at all.
 */
export function findCaptionLine(scaler: HTMLElement, lineId: string): HTMLElement | null {
  const line = scaler.querySelector<HTMLElement>(
    `.segment[data-tscaps-segment-id] > [${CAPTION_ELEMENT_ID_ATTRIBUTE}="${CSS.escape(lineId)}"]`,
  );
  return line && line.getClientRects().length > 0 ? line : null;
}

/**
 * Reads the box one line of a caption spans, in `scaler`-relative
 * coordinates: as wide as the caption's content box, as tall as the line
 * is painted, and inflated by a corona on each axis.
 *
 * The height is the painted one, so a line the template scales or slides
 * is reached where it is drawn. The width is the caption's rather than
 * the line's, so a short line under a long one is reached across the
 * whole caption, as the caption's own outline suggests.
 */
export function measureCaptionLineChrome(
  line: HTMLElement,
  scaler: HTMLElement,
  horizontalCoronaPx: number,
  verticalCoronaPx: number,
): ChromeGeometry {
  // Every line `findCaptionLine` answers is a child of its caption's `.segment`.
  const segment = line.parentElement!;
  const content = contentBoxMeasurer.measure(segment, scaler);
  const rendered = transformResolver.resolve(segment, scaler);
  const width = content.width * rendered.scaleX + horizontalCoronaPx * 2;
  const lineBox = line.getBoundingClientRect();
  const scalerBox = scaler.getBoundingClientRect();
  return {
    left: content.left + content.width / 2 - width / 2,
    top: lineBox.top - scalerBox.top - verticalCoronaPx,
    width,
    height: lineBox.height + verticalCoronaPx * 2,
  };
}

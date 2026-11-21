import type { AlignmentConfig, TextDirection } from '@tscaps/engine';
import type { HorizontalPlacementResolver } from '@tscaps/engine/advanced';
import type { ElementPositionBaseline } from '@presentation/editor/services/ElementAlignmentResolver';
import { CAPTION_ELEMENT_ID_ATTRIBUTE } from '@presentation/editor/services/CaptionElementAttribute';

/**
 * Anchor point of a painted element on-screen as a fraction of the
 * video frame. Edge is picked by `alignment` so committing this value
 * pins the element where it already sits — no visual jump on the first
 * slider tick. The edges travel back with the offsets they placed: a
 * fraction alone is only a position while the anchor that framed it
 * holds still. `null` when the element is not currently rendered.
 *
 * Found by the styling hook rather than by a hit-testing attribute:
 * that one is duplicated onto the invisible ghost that receives clicks,
 * and measuring the ghost would report the wrong box. The preview
 * stamps the styling hook on every element it paints, so a word, a
 * glyph, a line and a caption are all reachable the same way.
 */
export function measureElementAnchorFraction(
  elementId: string,
  alignment: AlignmentConfig,
  textDirection: TextDirection,
  horizontalPlacementResolver: HorizontalPlacementResolver,
): ElementPositionBaseline | null {
  const escapedId = CSS.escape(elementId);
  const painted = document.querySelector<HTMLElement>(
    `.subtitle-overlay-scaler [${CAPTION_ELEMENT_ID_ATTRIBUTE}="${escapedId}"]`,
  );
  if (!painted) return null;
  const scaler = painted.closest<HTMLElement>('.subtitle-overlay-scaler');
  if (!scaler) return null;

  const paintedRect = painted.getBoundingClientRect();
  const scalerRect = scaler.getBoundingClientRect();
  if (scalerRect.width === 0 || scalerRect.height === 0) return null;

  const anchorY =
    alignment.verticalAlign === 'top' ? paintedRect.top :
    alignment.verticalAlign === 'bottom' ? paintedRect.bottom :
    paintedRect.top + paintedRect.height / 2;
  const { side } = horizontalPlacementResolver.resolve(
    alignment.horizontalAlign,
    alignment.horizontalOffset,
    textDirection,
  );
  const anchorX =
    side === 'left' ? paintedRect.left :
    side === 'right' ? paintedRect.right :
    paintedRect.left + paintedRect.width / 2;

  return {
    verticalAlign: alignment.verticalAlign,
    verticalOffset: (anchorY - scalerRect.top) / scalerRect.height,
    horizontalAlign: side,
    horizontalOffset: (anchorX - scalerRect.left) / scalerRect.width,
  };
}

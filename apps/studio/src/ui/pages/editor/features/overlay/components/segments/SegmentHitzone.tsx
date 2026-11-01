import { memo, useRef } from 'react';
import type { Segment } from '@tscaps/engine';
import type { ChromeGeometry } from '@presentation/editor/services/OverlayChromeSource';
import { applyChromeGeometry } from '@ui/pages/editor/features/overlay/chromeGeometry';
import { findCaptionLine, measureCaptionLineChrome } from '@ui/pages/editor/features/overlay/segmentElementProbe';
import { SEGMENT_HITZONE_CORONA } from '@ui/pages/editor/features/overlay/segmentHitzoneCorona';
import { useChromeReposition } from '@ui/pages/editor/features/overlay/hooks/useChromeReposition';

interface SegmentHitzoneProps {
  segment: Segment;
  /** The overlay scaler the chrome is mounted in and measured against. */
  scaler: HTMLElement | null;
}

/**
 * The segment's clickable surface: one invisible ghost per line, as
 * wide as the caption content box and as tall as the line, each grown
 * by `SEGMENT_HITZONE_CORONA`. The engine's
 * structural elements are pointer-transparent (words re-arm as leaf
 * targets), so every segment-level hit — the corona around the text,
 * the gap between two lines — lands on a ghost.
 *
 * One per line rather than one around the whole caption, because a
 * caption box can hold empty space the template means as part of the
 * shot: a layout that sets one word at the top of the frame and the
 * rest at the bottom spans most of the picture, and a click on the face
 * between them is a click on the video. The lines of an ordinary
 * caption sit closer than two coronas, so their ghosts overlap into the
 * rectangle the selection outline draws; only a gap wider than that lets
 * the click through, and only while the caption is not selected: the
 * selected one is also reached anywhere inside its outline.
 *
 * Cannot live inside the segment subtree: templates are free to set
 * `overflow: hidden` on `.segment` (e.g. to clip an animated
 * `clip-path`), which would clip the enlarged reach, and
 * `rendering.padding` safety-bleed would inflate the clickable box
 * past the visible text. Mounted at the scaler level, the ghosts are
 * siblings of the caption tree, so no template style can reshape them.
 *
 * Every ghost carries `data-tscaps-segment-id`: selection resolves it
 * via `closest`, and the scaler's delegated pointerdown starts a
 * segment drag from it. They paint below the caption in tree order, so
 * word hits still resolve to the word.
 */
export const SegmentHitzone = memo(function SegmentHitzone({ segment, scaler }: SegmentHitzoneProps) {
  return (
    <>
      {segment.lines.map((line) => (
        <LineHitzone key={line.id} segmentId={segment.id} lineId={line.id} scaler={scaler} />
      ))}
    </>
  );
});

interface LineHitzoneProps {
  segmentId: string;
  lineId: string;
  scaler: HTMLElement | null;
}

const LineHitzone = memo(function LineHitzone({ segmentId, lineId, scaler }: LineHitzoneProps) {
  const boxRef = useRef<HTMLDivElement>(null);

  useChromeReposition({
    boxRef,
    scaler,
    targetId: lineId,
    resolveTarget: findCaptionLine,
    measure: measureLineHitzone,
    apply: applyChromeGeometry,
  });

  return (
    <div
      ref={boxRef}
      className="subtitle-overlay-segment-hitzone"
      data-tscaps-segment-id={segmentId}
      aria-hidden
    />
  );
});

function measureLineHitzone(line: HTMLElement, scaler: HTMLElement): ChromeGeometry {
  return measureCaptionLineChrome(line, scaler, SEGMENT_HITZONE_CORONA.horizontalPx, SEGMENT_HITZONE_CORONA.verticalPx);
}

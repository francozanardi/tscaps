import { memo, useRef } from 'react';
import type { Sheet } from '@core/sheets/domain/Sheet';
import type { ElementStyles } from '@core/elements/domain/ElementStyles';
import type { ChromeGeometry } from '@presentation/editor/services/OverlayChromeSource';
import { applyChromeGeometry } from '@ui/pages/editor/features/overlay/chromeGeometry';
import { findSegmentElement, measureSegmentChrome } from '@ui/pages/editor/features/overlay/segmentElementProbe';
import { SEGMENT_HITZONE_CORONA } from '@ui/pages/editor/features/overlay/segmentHitzoneCorona';
import { useChromeReposition } from '@ui/pages/editor/features/overlay/hooks/useChromeReposition';
import { useSegmentChromeRotation } from '@ui/pages/editor/features/overlay/hooks/useSegmentChromeRotation';

interface SelectedSegmentHitzoneProps {
  segmentId: string;
  sheet: Sheet;
  elementStyles: ElementStyles;
  /** The overlay scaler the ghost is mounted in and measured against. */
  scaler: HTMLElement | null;
}

/**
 * The selected caption's click surface over the whole rectangle its
 * selection outline draws, at the outline's angle. The line ghosts leave
 * a wide gap between two lines to the video; once the outline is drawn
 * around that gap, a press inside it is a press on the caption, so it
 * drags the caption and keeps it selected.
 *
 * Mounted with the line ghosts, before the caption tree, so a word
 * inside the outline still resolves to the word. Hidden, like the
 * outline, while the caption is not painted.
 */
export const SelectedSegmentHitzone = memo(function SelectedSegmentHitzone({
  segmentId,
  sheet,
  elementStyles,
  scaler,
}: SelectedSegmentHitzoneProps) {
  const boxRef = useRef<HTMLDivElement>(null);
  const rotationDeg = useSegmentChromeRotation(segmentId, sheet, elementStyles);

  useChromeReposition({
    boxRef,
    scaler,
    targetId: segmentId,
    resolveTarget: findSegmentElement,
    measure: measureSelectedHitzone,
    apply: applyChromeGeometry,
  });

  return (
    <div
      ref={boxRef}
      className="subtitle-overlay-segment-hitzone"
      data-tscaps-segment-id={segmentId}
      style={{ transform: `rotate(${rotationDeg}deg)` }}
      aria-hidden
    />
  );
});

function measureSelectedHitzone(segment: HTMLElement, scaler: HTMLElement): ChromeGeometry {
  return measureSegmentChrome(segment, scaler, SEGMENT_HITZONE_CORONA.horizontalPx, SEGMENT_HITZONE_CORONA.verticalPx);
}

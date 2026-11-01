import { memo, useRef } from 'react';
import type { Sheet } from '@core/sheets/domain/Sheet';
import type { ElementStyles } from '@core/elements/domain/ElementStyles';
import type { ChromeGeometry } from '@presentation/editor/services/OverlayChromeSource';
import { ManipulationHandles } from '@ui/pages/editor/features/overlay/components/segments/ManipulationHandles';
import { SegmentRotateHandle } from '@ui/pages/editor/features/overlay/components/segments/SegmentRotateHandle';
import { applyChromeGeometry } from '@ui/pages/editor/features/overlay/chromeGeometry';
import { findSegmentElement, measureSegmentChrome } from '@ui/pages/editor/features/overlay/segmentElementProbe';
import { useChromeReposition } from '@ui/pages/editor/features/overlay/hooks/useChromeReposition';
import { useSegmentChromeRotation } from '@ui/pages/editor/features/overlay/hooks/useSegmentChromeRotation';

interface SegmentSelectionChromeProps {
  segmentId: string;
  sheet: Sheet;
  elementStyles: ElementStyles;
  /** The overlay scaler the chrome is mounted in and measured against. */
  scaler: HTMLElement | null;
  variant: 'selected' | 'drop-target';
}

/**
 * Segment chrome (selection stroke / drop-target cue, plus the resize
 * and rotate handles when selected) drawn as a ghost box at the scaler
 * level, outside the segment subtree. It cannot live inside `.segment`:
 * the actor-cutout canvas paints above the caption layers, and the
 * scaler's `container-type` makes it a stacking context — no z-index
 * inside the segment tree can cross the cutout. Mounted after the
 * cutout, the chrome wins by tree order.
 *
 * Geometry comes from `CaptionContentBoxMeasurer`, so the outline
 * hugs the visible caption regardless of engine-injected
 * `rendering.padding` safety-bleed, template CSS padding, or `overflow:
 * hidden` on `.segment`. The measured center already reflects any
 * template translate on `.segment` (behind-actor lift, per-frame paint
 * animation); the chrome applies the segment's rotation itself.
 */
export const SegmentSelectionChrome = memo(function SegmentSelectionChrome({
  segmentId,
  sheet,
  elementStyles,
  scaler,
  variant,
}: SegmentSelectionChromeProps) {
  const boxRef = useRef<HTMLDivElement>(null);
  const rotationDeg = useSegmentChromeRotation(segmentId, sheet, elementStyles);

  useChromeReposition({
    boxRef,
    scaler,
    targetId: segmentId,
    resolveTarget: findSegmentElement,
    measure: measureChrome,
    apply: applyChromeGeometry,
  });

  const supportsRotation = sheet.template.features.rotation.segment;

  const variantClass = variant === 'selected' ? 'is-selected' : 'is-drop-target';
  return (
    <div
      ref={boxRef}
      className={`subtitle-overlay-segment-chrome ${variantClass}`}
      style={{ transform: `rotate(${rotationDeg}deg)` }}
      aria-hidden
    >
      {variant === 'selected' && <ManipulationHandles segmentId={segmentId} />}
      {variant === 'selected' && supportsRotation && <SegmentRotateHandle segmentId={segmentId} />}
    </div>
  );
});

function measureChrome(segment: HTMLElement, scaler: HTMLElement): ChromeGeometry {
  return measureSegmentChrome(segment, scaler, 0, 0);
}

import { memo, useLayoutEffect, useRef, type MouseEvent } from 'react';
import { RotateCw } from 'lucide-react';
import { useOverlayManipulationController } from '@ui/pages/editor/features/overlay/contexts/OverlayManipulationContext';
import { useOverlayDragState } from '@ui/pages/editor/features/overlay/hooks/useOverlayDragState';

interface SegmentRotateHandleProps {
  segmentId: string;
}

/**
 * Round icon centered on the top edge of the selected segment that the
 * user grabs to rotate it. Renders as a sibling of the corner resize
 * handles inside the selection chrome box, so the absolute offsets
 * land at the visible chrome's top-edge midpoint. A drag commits a per-segment
 * rotation override (the sheet-global slider stays in the Position
 * tab); a click without drag does nothing (the local click handler
 * swallows the bubble so the overlay's selection click never re-runs
 * and dismisses the popover). The icon swaps to the live degree value
 * while the gesture is in flight.
 */
export const SegmentRotateHandle = memo(function SegmentRotateHandle({ segmentId }: SegmentRotateHandleProps) {
  const controller = useOverlayManipulationController();
  const dragState = useOverlayDragState();
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const handle = ref.current;
    if (!handle) return;
    return controller.bindSegmentRotateHandle({ segmentId, handle });
  }, [controller, segmentId]);
  const rotationLabel = dragState?.kind === 'segment-rotate' && dragState.segmentId === segmentId
    ? `${Math.round(dragState.rotationDeg)}°`
    : null;
  const className = rotationLabel !== null
    ? 'subtitle-overlay-segment-rotate-handle is-rotating'
    : 'subtitle-overlay-segment-rotate-handle';
  return (
    <div ref={ref} className={className} onClick={swallowClick} aria-hidden>
      {rotationLabel ?? <RotateCw size={12} />}
    </div>
  );
});

function swallowClick(event: MouseEvent): void {
  event.stopPropagation();
}

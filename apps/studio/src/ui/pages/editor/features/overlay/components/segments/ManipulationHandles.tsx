import { memo, useLayoutEffect, useRef, type MouseEvent } from 'react';
import type { ResizeCorner } from '@presentation/editor/services/ResizeGeometryResolver';
import { useOverlayManipulationController } from '@ui/pages/editor/features/overlay/contexts/OverlayManipulationContext';

interface ManipulationHandlesProps {
  segmentId: string;
}

const CORNERS: readonly ResizeCorner[] = ['tl', 'tr', 'bl', 'br'];

const CORNER_CLASS_BY_KIND: Record<ResizeCorner, string> = {
  tl: 'subtitle-overlay-segment-handle-tl',
  tr: 'subtitle-overlay-segment-handle-tr',
  bl: 'subtitle-overlay-segment-handle-bl',
  br: 'subtitle-overlay-segment-handle-br',
};

/**
 * Four corner handles for the currently-selected segment. A drag from
 * a handle scales the sheet's font size uniformly via the manipulation
 * controller; a click without drag does nothing (the local click
 * handler swallows the bubble so the overlay's selection click
 * handler never re-runs and dismisses the popover).
 *
 * Renders inside the selection chrome box, which mirrors the segment
 * hitzone — the absolute offsets land the handles at the outer corners
 * of the visible chrome rectangle.
 */
export const ManipulationHandles = memo(function ManipulationHandles({ segmentId }: ManipulationHandlesProps) {
  return (
    <>
      {CORNERS.map((corner) => (
        <CornerHandle key={corner} segmentId={segmentId} corner={corner} />
      ))}
    </>
  );
});

interface CornerHandleProps {
  segmentId: string;
  corner: ResizeCorner;
}

function CornerHandle({ segmentId, corner }: CornerHandleProps) {
  const controller = useOverlayManipulationController();
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const handle = ref.current;
    if (!handle) return;
    return controller.bindSegmentResizeHandle({ segmentId, corner, handle });
  }, [controller, segmentId, corner]);
  const className = `subtitle-overlay-segment-handle ${CORNER_CLASS_BY_KIND[corner]}`;
  return <div ref={ref} className={className} onClick={swallowClick} aria-hidden />;
}

function swallowClick(event: MouseEvent): void {
  event.stopPropagation();
}

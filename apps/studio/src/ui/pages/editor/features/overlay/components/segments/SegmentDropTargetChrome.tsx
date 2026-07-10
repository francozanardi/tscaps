import type { RefObject } from 'react';
import type { Sheet } from '@core/sheets/domain/Sheet';
import type { SegmentOverrides } from '@core/captions/domain/SegmentOverrides';
import { SegmentSelectionChrome } from '@ui/pages/editor/features/overlay/components/segments/SegmentSelectionChrome';
import { useOverlayDragState } from '@ui/pages/editor/features/overlay/hooks/useOverlayDragState';

const NO_VARS: Readonly<Record<string, string>> = {};

interface SegmentDropTargetChromeProps {
  sheetBySegmentId: ReadonlyMap<string, Sheet>;
  segmentOverrides: SegmentOverrides;
  behindActorVarsBySegment: ReadonlyMap<string, Readonly<Record<string, string>>>;
  /** The overlay scaler the chrome is measured against and mounted in. */
  containerRef: RefObject<HTMLElement>;
}

/**
 * Drop-zone highlight for the segment that would take a dragged word
 * back into flow on release. Subscribes to the drag state itself so
 * only this component re-renders on drag ticks, and renders nothing
 * outside a word drag with a live drop target.
 */
export function SegmentDropTargetChrome({
  sheetBySegmentId,
  segmentOverrides,
  behindActorVarsBySegment,
  containerRef,
}: SegmentDropTargetChromeProps) {
  const dragState = useOverlayDragState();
  if (dragState?.kind !== 'word' || dragState.dropTargetSegmentId === null) return null;
  const segmentId = dragState.dropTargetSegmentId;
  const sheet = sheetBySegmentId.get(segmentId);
  if (!sheet) return null;
  return (
    <SegmentSelectionChrome
      segmentId={segmentId}
      sheet={sheet}
      segmentOverrides={segmentOverrides}
      behindActorVars={behindActorVarsBySegment.get(segmentId) ?? NO_VARS}
      containerRef={containerRef}
      variant="drop-target"
    />
  );
}

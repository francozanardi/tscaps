import { memo } from 'react';
import type { OverlaySelection } from '@presentation/editor/controllers/OverlaySelectionController';
import { useAltKeyHeld } from '@ui/pages/editor/features/overlay/hooks/useAltKeyHeld';
import { useOverlayDragState } from '@ui/pages/editor/features/overlay/hooks/useOverlayDragState';

interface SegmentScopeChipProps {
  selection: OverlaySelection;
}

const CHIP_TEXT = 'Affects only this scene';

/**
 * Floating reminder pinned to the top of the scaler that surfaces
 * the "Alt = only this segment" modifier whenever it is — or just
 * was — about to alter what a segment gesture writes. Visible while
 * Alt is held with a segment selected, and also during an in-flight
 * scoped segment rotate / resize so the chip survives the user
 * releasing Alt mid-drag.
 */
export const SegmentScopeChip = memo(function SegmentScopeChip({ selection }: SegmentScopeChipProps) {
  const altHeld = useAltKeyHeld();
  const dragState = useOverlayDragState();
  const scopedDrag =
    (dragState?.kind === 'segment-rotate' || dragState?.kind === 'segment-resize')
    && dragState.scopedToSegment;
  const hasSegmentSelection = Boolean(selection?.segmentId);
  if (!scopedDrag && !(altHeld && hasSegmentSelection)) return null;
  return (
    <div className="subtitle-overlay-segment-scope-chip" aria-hidden>
      {CHIP_TEXT}
    </div>
  );
});

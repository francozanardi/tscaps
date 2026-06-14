import { useCallback, useSyncExternalStore } from 'react';
import { useOverlayManipulationController } from '@ui/pages/editor/features/overlay/contexts/OverlayManipulationContext';

/**
 * Returns `true` while an active word drag would, on release, return
 * its detached word back to flow inside the given `segmentId`. Used by
 * the segment chrome to paint a drop-zone highlight that telegraphs
 * the pending commit before the user lets go.
 */
export function useIsDropTargetSegment(segmentId: string): boolean {
  const controller = useOverlayManipulationController();
  const subscribe = useCallback((notify: () => void) => controller.subscribe(notify), [controller]);
  return useSyncExternalStore(subscribe, () => {
    const state = controller.snapshot();
    if (!state || state.kind !== 'word') return false;
    return state.dropTargetSegmentId === segmentId;
  });
}

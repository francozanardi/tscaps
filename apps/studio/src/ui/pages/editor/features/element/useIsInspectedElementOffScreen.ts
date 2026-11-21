import { useCallback, useSyncExternalStore } from 'react';
import type { OverlaySelectionController } from '@presentation/editor/controllers/OverlaySelectionController';
import type { InspectedElement } from '@ui/pages/editor/features/element/useInspectedElement';

/**
 * Whether the playhead is off the element being edited: a caption
 * element, a layer, or a shot, whose own video is what is off. False
 * for several layers edited together, which sit in different shots and
 * so cannot be said to be off screen.
 */
export function useIsInspectedElementOffScreen(
  element: InspectedElement | null,
  selectionController: OverlaySelectionController,
): boolean {
  const subscribe = useCallback((notify: () => void) => selectionController.subscribe(notify), [selectionController]);
  const isOnScreen = useSyncExternalStore(subscribe, () => selectionController.paintedSelectionSnapshot() !== null);
  if (element === null || element.kind === 'shot-layers') return false;
  return !isOnScreen;
}

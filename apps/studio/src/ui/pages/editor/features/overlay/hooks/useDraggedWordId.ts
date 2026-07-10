import { useSyncExternalStore } from 'react';
import { useOverlayManipulationController } from '@ui/pages/editor/features/overlay/contexts/OverlayManipulationContext';

/**
 * Returns the id of the word the user is currently dragging, or
 * `null` when no word drag is active. Stable across renders when the
 * id hasn't changed — string identity carries through, so consumers
 * that only branch on the id do not re-render on every pointermove.
 */
export function useDraggedWordId(): string | null {
  const controller = useOverlayManipulationController();
  return useSyncExternalStore(
    (callback) => controller.subscribe(callback),
    () => {
      const state = controller.snapshot();
      return state?.kind === 'word' ? state.wordId : null;
    },
    () => null,
  );
}

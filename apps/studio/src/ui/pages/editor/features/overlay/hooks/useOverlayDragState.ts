import { useSyncExternalStore } from 'react';
import type { OverlayDragState } from '@presentation/editor/controllers/OverlayManipulationController';
import { useOverlayManipulationController } from '@ui/pages/editor/features/overlay/contexts/OverlayManipulationContext';

/**
 * Reactive read of the manipulation controller's drag state. Returns
 * `null` when no drag is in progress, otherwise the current delta and
 * snap resolution. Re-renders the calling component on every emit.
 */
export function useOverlayDragState(): OverlayDragState | null {
  const controller = useOverlayManipulationController();
  return useSyncExternalStore(
    (callback) => controller.subscribe(callback),
    () => controller.snapshot(),
    () => null,
  );
}

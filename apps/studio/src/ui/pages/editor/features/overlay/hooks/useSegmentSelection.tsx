import { useCallback, useEffect, useSyncExternalStore, type MouseEvent } from 'react';
import type {
  OverlaySelection,
  OverlayPopoverAnchor,
  OverlaySelectionController,
} from '@presentation/editor/controllers/OverlaySelectionController';

export type Selection = OverlaySelection;
export type PopoverAnchor = OverlayPopoverAnchor;

export interface SegmentSelection {
  selection: Selection;
  popover: PopoverAnchor;
  setSelection: (next: Selection) => void;
  dismiss: () => void;
  onClick: (event: MouseEvent) => void;
  onContextMenu: (event: MouseEvent) => void;
}

/**
 * Reads the overlay's current selection and right-click popover anchor
 * from the controller and exposes the click handlers the overlay
 * attaches to its scaler. Auto-dismisses the selection whenever the
 * selected segment leaves `activeSegmentIds` — that data only lives in
 * React, so it stays in the hook rather than the controller.
 */
export function useSegmentSelection(
  activeSegmentIds: ReadonlySet<string>,
  controller: OverlaySelectionController,
): SegmentSelection {
  const subscribe = useCallback((notify: () => void) => controller.subscribe(notify), [controller]);
  const selection = useSyncExternalStore(subscribe, () => controller.selectionSnapshot());
  const popover = useSyncExternalStore(subscribe, () => controller.popoverSnapshot());

  const selectedSegmentId = selection?.segmentId ?? null;
  useEffect(() => {
    if (selectedSegmentId === null) return;
    if (!activeSegmentIds.has(selectedSegmentId)) controller.dismiss();
  }, [activeSegmentIds, selectedSegmentId, controller]);

  const setSelection = useCallback(
    (next: Selection) => controller.setSelection(next),
    [controller],
  );
  const dismiss = useCallback(() => controller.dismiss(), [controller]);

  const onClick = useCallback((event: MouseEvent) => {
    const target = event.target as HTMLElement;
    controller.selectAtPoint(target, event.clientX, event.clientY, false);
  }, [controller]);

  const onContextMenu = useCallback((event: MouseEvent) => {
    const target = event.target as HTMLElement;
    if (!controller.selectAtPoint(target, event.clientX, event.clientY, true)) return;
    event.preventDefault();
  }, [controller]);

  return { selection, popover, setSelection, dismiss, onClick, onContextMenu };
}

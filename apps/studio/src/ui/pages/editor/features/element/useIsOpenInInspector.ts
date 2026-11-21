import { useCallback, useSyncExternalStore } from 'react';
import type { OverlaySelectionController } from '@presentation/editor/controllers/OverlaySelectionController';
import { useIsElementInspectorOpen } from '@ui/pages/editor/hooks/useIsElementInspectorOpen';

/** Whether the inspector is open and editing the word `wordId`, so asking to open it there would change nothing. */
export function useIsOpenInInspector(selectionController: OverlaySelectionController, wordId: string): boolean {
  const isInspectorOpen = useIsElementInspectorOpen();
  const subscribe = useCallback((notify: () => void) => selectionController.subscribe(notify), [selectionController]);
  const isPicked = useSyncExternalStore(subscribe, () => {
    const selection = selectionController.selectionSnapshot();
    return selection?.kind === 'caption' && selection.wordId === wordId;
  });
  return isInspectorOpen && isPicked;
}

import { useCallback, useSyncExternalStore } from 'react';
import type { ShotTransitionRequest } from '@presentation/editor/stores/EditorWorkspaceStore';
import { useEditorWorkspaceStore } from '@ui/pages/editor/contexts/EditorWorkspaceContext';

/** Reactive read of the shot transition a panel last asked the Video mode to open; null where none is waiting. */
export function useShotTransitionRequest(): ShotTransitionRequest | null {
  const store = useEditorWorkspaceStore();
  const subscribe = useCallback((cb: () => void) => {
    store.addEventListener('change', cb);
    return () => store.removeEventListener('change', cb);
  }, [store]);
  const getSnapshot = useCallback(() => store.shotTransitionRequest, [store]);
  return useSyncExternalStore(subscribe, getSnapshot);
}

import { useCallback, useSyncExternalStore } from 'react';
import type { VideoTabId } from '@presentation/editor/stores/VideoTabStore';
import { useVideoTabStore } from '@ui/pages/editor/contexts/VideoTabContext';

/**
 * Reactive read of the active Video-sidebar tab. Re-renders consumers
 * only when the active tab id itself changes.
 */
export function useActiveVideoTab(): VideoTabId {
  const store = useVideoTabStore();
  const subscribe = useCallback((cb: () => void) => {
    store.addEventListener('change', cb);
    return () => store.removeEventListener('change', cb);
  }, [store]);
  const getSnapshot = useCallback(() => store.activeTabId, [store]);
  return useSyncExternalStore(subscribe, getSnapshot);
}

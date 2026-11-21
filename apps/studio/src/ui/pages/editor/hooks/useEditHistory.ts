import { useCallback, useSyncExternalStore } from 'react';
import type { HistoryTimeline } from '@core/editor/domain/HistoryCheckpoint';
import { useEditor } from '@ui/_shared/contexts/modules/EditorContext';

/** The editor's edit history, re-rendering only when it changes. */
export function useEditHistory(): HistoryTimeline {
  const { store } = useEditor();
  const subscribe = useCallback((notify: () => void) => {
    store.addEventListener('change', notify);
    return () => store.removeEventListener('change', notify);
  }, [store]);
  return useSyncExternalStore(subscribe, () => store.history());
}

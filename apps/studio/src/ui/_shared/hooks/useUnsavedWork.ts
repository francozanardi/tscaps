import { useCallback, useSyncExternalStore } from 'react';
import { useEditor } from '@ui/_shared/contexts/modules/EditorContext';
import { useProjects } from '@ui/_shared/contexts/modules/ProjectsContext';

/**
 * Whether leaving or reloading the tab right now would lose work the
 * reader could otherwise keep, as the projects module decides it for
 * the browser's own leave warning. Read again on every editor change;
 * the caller re-renders only when the answer changes.
 */
export function useUnsavedWork(): boolean {
  const { unsavedWorkPolicy } = useProjects();
  const { store } = useEditor();
  const subscribe = useCallback((notify: () => void) => {
    store.addEventListener('change', notify);
    return () => store.removeEventListener('change', notify);
  }, [store]);
  return useSyncExternalStore(subscribe, () => unsavedWorkPolicy.shouldWarnBeforeLeave());
}

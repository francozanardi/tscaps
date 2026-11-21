import { useCallback, useSyncExternalStore } from 'react';
import type { InspectorPageRequest } from '@presentation/editor/stores/EditorWorkspaceStore';
import { useEditorWorkspaceStore } from '@ui/pages/editor/contexts/EditorWorkspaceContext';

/** Reactive read of the inspector page a panel last asked for; null where none did. */
export function useInspectorPageRequest(): InspectorPageRequest | null {
  const store = useEditorWorkspaceStore();
  const subscribe = useCallback((cb: () => void) => {
    store.addEventListener('change', cb);
    return () => store.removeEventListener('change', cb);
  }, [store]);
  const getSnapshot = useCallback(() => store.inspectorPageRequest, [store]);
  return useSyncExternalStore(subscribe, getSnapshot);
}

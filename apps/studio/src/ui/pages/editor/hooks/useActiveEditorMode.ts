import { useCallback, useSyncExternalStore } from 'react';
import type { EditorModeId } from '@presentation/editor/stores/EditorWorkspaceStore';
import { useEditorWorkspaceStore } from '@ui/pages/editor/contexts/EditorWorkspaceContext';

/**
 * Reactive read of the active editor mode (Captions, Cuts, ...).
 * Re-renders consumers only when the active mode id itself changes.
 */
export function useActiveEditorMode(): EditorModeId {
  const store = useEditorWorkspaceStore();
  const subscribe = useCallback((cb: () => void) => {
    store.addEventListener('change', cb);
    return () => store.removeEventListener('change', cb);
  }, [store]);
  const getSnapshot = useCallback(() => store.activeModeId, [store]);
  return useSyncExternalStore(subscribe, getSnapshot);
}

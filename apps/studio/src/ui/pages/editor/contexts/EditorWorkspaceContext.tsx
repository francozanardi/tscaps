import { createContext, useContext, type ReactNode } from 'react';
import type { EditorWorkspaceStore } from '@presentation/editor/stores/EditorWorkspaceStore';

const EditorWorkspaceStoreContext = createContext<EditorWorkspaceStore | null>(null);

interface EditorWorkspaceStoreProviderProps {
  value: EditorWorkspaceStore;
  children: ReactNode;
}

export function EditorWorkspaceStoreProvider({ value, children }: EditorWorkspaceStoreProviderProps) {
  return (
    <EditorWorkspaceStoreContext.Provider value={value}>
      {children}
    </EditorWorkspaceStoreContext.Provider>
  );
}

/**
 * Returns the workspace store provided by the closest ancestor. Throws
 * if mounted outside `<EditorWorkspaceStoreProvider>`; that is always a
 * wiring bug and should surface loudly.
 */
export function useEditorWorkspaceStore(): EditorWorkspaceStore {
  const value = useContext(EditorWorkspaceStoreContext);
  if (!value) throw new Error('useEditorWorkspaceStore must be used inside <EditorWorkspaceStoreProvider>');
  return value;
}

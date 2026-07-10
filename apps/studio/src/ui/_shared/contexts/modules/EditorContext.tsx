import { createContext, useContext, type ReactNode } from 'react';
import type { EditorModule } from '@bootstrap/wiring/editor';

const EditorContext = createContext<EditorModule | null>(null);

interface EditorProviderProps {
  value: EditorModule;
  children: ReactNode;
}

export function EditorProvider({ value, children }: EditorProviderProps) {
  return <EditorContext.Provider value={value}>{children}</EditorContext.Provider>;
}

/**
 * Returns the editor module. Throws if the consumer is mounted
 * outside `<EditorProvider>`; that is always a wiring bug and should
 * surface loudly rather than fall back to a stale or partial surface.
 */
export function useEditor(): EditorModule {
  const value = useContext(EditorContext);
  if (!value) throw new Error('useEditor must be used inside <EditorProvider>');
  return value;
}

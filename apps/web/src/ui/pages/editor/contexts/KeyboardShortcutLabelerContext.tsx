import { createContext, useContext, type ReactNode } from 'react';
import type { KeyboardShortcutLabeler } from '@presentation/editor/services/KeyboardShortcutLabeler';

const KeyboardShortcutLabelerContext = createContext<KeyboardShortcutLabeler | null>(null);

interface KeyboardShortcutLabelerProviderProps {
  value: KeyboardShortcutLabeler;
  children: ReactNode;
}

export function KeyboardShortcutLabelerProvider({ value, children }: KeyboardShortcutLabelerProviderProps) {
  return <KeyboardShortcutLabelerContext.Provider value={value}>{children}</KeyboardShortcutLabelerContext.Provider>;
}

export function useKeyboardShortcutLabeler(): KeyboardShortcutLabeler {
  const value = useContext(KeyboardShortcutLabelerContext);
  if (!value) throw new Error('useKeyboardShortcutLabeler must be used inside <KeyboardShortcutLabelerProvider>');
  return value;
}

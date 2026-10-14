import { createContext, useContext, type ReactNode } from 'react';
import type { ShortcutsModule } from '@bootstrap/wiring/shortcuts';

const ShortcutsContext = createContext<ShortcutsModule | null>(null);

interface ShortcutsProviderProps {
  value: ShortcutsModule;
  children: ReactNode;
}

export function ShortcutsProvider({ value, children }: ShortcutsProviderProps) {
  return <ShortcutsContext.Provider value={value}>{children}</ShortcutsContext.Provider>;
}

/**
 * Returns the shortcuts module — the command catalog, the keymap store
 * and the actions that change the user's keymap. Throws if mounted
 * outside `<ShortcutsProvider>`; that is always a wiring bug.
 */
export function useShortcuts(): ShortcutsModule {
  const value = useContext(ShortcutsContext);
  if (!value) throw new Error('useShortcuts must be used inside <ShortcutsProvider>');
  return value;
}

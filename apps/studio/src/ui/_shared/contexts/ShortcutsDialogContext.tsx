import { createContext, useContext, type ReactNode } from 'react';
import type { ShortcutsDialogStore } from '@presentation/shortcuts/stores/ShortcutsDialogStore';

const ShortcutsDialogStoreContext = createContext<ShortcutsDialogStore | null>(null);

interface ShortcutsDialogStoreProviderProps {
  value: ShortcutsDialogStore;
  children: ReactNode;
}

export function ShortcutsDialogStoreProvider({ value, children }: ShortcutsDialogStoreProviderProps) {
  return <ShortcutsDialogStoreContext.Provider value={value}>{children}</ShortcutsDialogStoreContext.Provider>;
}

/**
 * Returns the store that opens and hides the keyboard shortcuts dialog.
 * Throws if mounted outside `<ShortcutsDialogStoreProvider>`; that is
 * always a wiring bug.
 */
export function useShortcutsDialogStore(): ShortcutsDialogStore {
  const value = useContext(ShortcutsDialogStoreContext);
  if (!value) throw new Error('useShortcutsDialogStore must be used inside <ShortcutsDialogStoreProvider>');
  return value;
}

import { createContext, useContext, type ReactNode } from 'react';
import type { ShortcutDispatcher } from '@presentation/shortcuts/controllers/ShortcutDispatcher';

const ShortcutDispatcherContext = createContext<ShortcutDispatcher | null>(null);

interface ShortcutDispatcherProviderProps {
  value: ShortcutDispatcher;
  children: ReactNode;
}

export function ShortcutDispatcherProvider({ value, children }: ShortcutDispatcherProviderProps) {
  return <ShortcutDispatcherContext.Provider value={value}>{children}</ShortcutDispatcherContext.Provider>;
}

/**
 * Returns the app's one keyboard shortcut dispatcher. Throws if mounted
 * outside `<ShortcutDispatcherProvider>`; that is always a wiring bug.
 */
export function useShortcutDispatcher(): ShortcutDispatcher {
  const value = useContext(ShortcutDispatcherContext);
  if (!value) throw new Error('useShortcutDispatcher must be used inside <ShortcutDispatcherProvider>');
  return value;
}

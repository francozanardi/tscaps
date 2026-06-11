import { createContext, useContext, type ReactNode } from 'react';
import type { UtilsModule } from '@bootstrap/wiring/utils';

const UtilsContext = createContext<UtilsModule | null>(null);

interface UtilsProviderProps {
  value: UtilsModule;
  children: ReactNode;
}

export function UtilsProvider({ value, children }: UtilsProviderProps) {
  return <UtilsContext.Provider value={value}>{children}</UtilsContext.Provider>;
}

/**
 * Returns the utils module. Throws if the consumer is mounted outside
 * `<UtilsProvider>`; that is always a wiring bug and should surface
 * loudly rather than fall back to a stale or partial surface.
 */
export function useUtils(): UtilsModule {
  const value = useContext(UtilsContext);
  if (!value) throw new Error('useUtils must be used inside <UtilsProvider>');
  return value;
}

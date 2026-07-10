import { createContext, useContext, type ReactNode } from 'react';
import type { SheetsModule } from '@bootstrap/wiring/sheets';

const SheetsContext = createContext<SheetsModule | null>(null);

interface SheetsProviderProps {
  value: SheetsModule;
  children: ReactNode;
}

export function SheetsProvider({ value, children }: SheetsProviderProps) {
  return <SheetsContext.Provider value={value}>{children}</SheetsContext.Provider>;
}

/**
 * Returns the sheets module. Throws if the consumer is mounted
 * outside `<SheetsProvider>`; that is always a wiring bug and should
 * surface loudly rather than fall back to a stale or partial surface.
 */
export function useSheets(): SheetsModule {
  const value = useContext(SheetsContext);
  if (!value) throw new Error('useSheets must be used inside <SheetsProvider>');
  return value;
}

import { createContext, useContext, type ReactNode } from 'react';
import type { ExportModule } from '@bootstrap/wiring/export';

const ExportContext = createContext<ExportModule | null>(null);

interface ExportProviderProps {
  value: ExportModule;
  children: ReactNode;
}

export function ExportProvider({ value, children }: ExportProviderProps) {
  return <ExportContext.Provider value={value}>{children}</ExportContext.Provider>;
}

/**
 * Returns the export module. Throws if the consumer is mounted
 * outside `<ExportProvider>`; that is always a wiring bug and should
 * surface loudly rather than fall back to a stale or partial surface.
 */
export function useExport(): ExportModule {
  const value = useContext(ExportContext);
  if (!value) throw new Error('useExport must be used inside <ExportProvider>');
  return value;
}

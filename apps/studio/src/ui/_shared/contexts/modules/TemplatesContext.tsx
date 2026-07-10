import { createContext, useContext, type ReactNode } from 'react';
import type { TemplatesModule } from '@bootstrap/wiring/templates';

const TemplatesContext = createContext<TemplatesModule | null>(null);

interface TemplatesProviderProps {
  value: TemplatesModule;
  children: ReactNode;
}

export function TemplatesProvider({ value, children }: TemplatesProviderProps) {
  return <TemplatesContext.Provider value={value}>{children}</TemplatesContext.Provider>;
}

/**
 * Returns the templates module. Throws if the consumer is mounted
 * outside `<TemplatesProvider>`; that is always a wiring bug and
 * should surface loudly rather than fall back to a stale or partial
 * surface.
 */
export function useTemplates(): TemplatesModule {
  const value = useContext(TemplatesContext);
  if (!value) throw new Error('useTemplates must be used inside <TemplatesProvider>');
  return value;
}

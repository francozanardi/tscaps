import { createContext, useContext, type ReactNode } from 'react';
import type { RoutingModule } from '@bootstrap/wiring/routing';

const RoutingContext = createContext<RoutingModule | null>(null);

interface RoutingProviderProps {
  value: RoutingModule;
  children: ReactNode;
}

export function RoutingProvider({ value, children }: RoutingProviderProps) {
  return <RoutingContext.Provider value={value}>{children}</RoutingContext.Provider>;
}

/**
 * Returns the routing module. Throws if the consumer is mounted
 * outside `<RoutingProvider>`; that is always a wiring bug and should
 * surface loudly rather than fall back to a stale or partial value.
 */
export function useRouting(): RoutingModule {
  const value = useContext(RoutingContext);
  if (!value) throw new Error('useRouting must be used inside <RoutingProvider>');
  return value;
}

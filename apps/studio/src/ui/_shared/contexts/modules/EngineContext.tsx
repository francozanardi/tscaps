import { createContext, useContext, type ReactNode } from 'react';
import type { EngineModule } from '@bootstrap/wiring/engine';

const EngineContext = createContext<EngineModule | null>(null);

interface EngineProviderProps {
  value: EngineModule;
  children: ReactNode;
}

export function EngineProvider({ value, children }: EngineProviderProps) {
  return <EngineContext.Provider value={value}>{children}</EngineContext.Provider>;
}

/**
 * Returns the engine module. Throws if the consumer is mounted
 * outside `<EngineProvider>`; that is always a wiring bug and should
 * surface loudly rather than fall back to a stale or partial surface.
 */
export function useEngine(): EngineModule {
  const value = useContext(EngineContext);
  if (!value) throw new Error('useEngine must be used inside <EngineProvider>');
  return value;
}

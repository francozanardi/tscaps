import { createContext, useContext, type ReactNode } from 'react';
import type { RenderingModule } from '@bootstrap/wiring/rendering';

const RenderingContext = createContext<RenderingModule | null>(null);

interface RenderingProviderProps {
  value: RenderingModule;
  children: ReactNode;
}

export function RenderingProvider({ value, children }: RenderingProviderProps) {
  return <RenderingContext.Provider value={value}>{children}</RenderingContext.Provider>;
}

/**
 * Returns the rendering module. Throws if the consumer is mounted
 * outside `<RenderingProvider>`; that is always a wiring bug and
 * should surface loudly rather than fall back to a stale or partial
 * surface.
 */
export function useRendering(): RenderingModule {
  const value = useContext(RenderingContext);
  if (!value) throw new Error('useRendering must be used inside <RenderingProvider>');
  return value;
}

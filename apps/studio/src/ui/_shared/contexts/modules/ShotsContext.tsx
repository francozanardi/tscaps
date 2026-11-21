import { createContext, useContext, type ReactNode } from 'react';
import type { ShotsModule } from '@bootstrap/wiring/shots';

const ShotsContext = createContext<ShotsModule | null>(null);

interface ShotsProviderProps {
  value: ShotsModule;
  children: ReactNode;
}

export function ShotsProvider({ value, children }: ShotsProviderProps) {
  return <ShotsContext.Provider value={value}>{children}</ShotsContext.Provider>;
}

/**
 * Returns the shots module — what cuts the video into shots. Throws if
 * mounted outside `<ShotsProvider>`; that is always a wiring bug and
 * should surface loudly.
 */
export function useShots(): ShotsModule {
  const value = useContext(ShotsContext);
  if (!value) throw new Error('useShots must be used inside <ShotsProvider>');
  return value;
}

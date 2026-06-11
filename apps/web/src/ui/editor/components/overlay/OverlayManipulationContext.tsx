import { createContext, useContext, type ReactNode } from 'react';
import type { OverlayManipulationController } from '@presentation/editor/controllers/OverlayManipulationController';

const OverlayManipulationContext = createContext<OverlayManipulationController | null>(null);

interface OverlayManipulationProviderProps {
  value: OverlayManipulationController;
  children: ReactNode;
}

export function OverlayManipulationProvider({ value, children }: OverlayManipulationProviderProps) {
  return <OverlayManipulationContext.Provider value={value}>{children}</OverlayManipulationContext.Provider>;
}

/**
 * Returns the manipulation controller that owns the overlay's drag and
 * resize lifecycle. Throws outside the overlay subtree — always a
 * wiring bug rather than a missing-feature fallback.
 */
export function useOverlayManipulationController(): OverlayManipulationController {
  const value = useContext(OverlayManipulationContext);
  if (!value) throw new Error('useOverlayManipulationController must be used inside <OverlayManipulationProvider>');
  return value;
}

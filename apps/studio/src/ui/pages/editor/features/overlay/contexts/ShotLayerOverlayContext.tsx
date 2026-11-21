import { createContext, useContext, type ReactNode } from 'react';
import type { ShotLayerHitTargetController } from '@presentation/shots/controllers/ShotLayerHitTargetController';
import type { ShotLayerManipulationController } from '@presentation/shots/controllers/ShotLayerManipulationController';

/** What the overlay needs to lay the shot layers' hit targets and move them. */
export interface ShotLayerOverlay {
  readonly hitTargets: ShotLayerHitTargetController;
  readonly manipulation: ShotLayerManipulationController;
}

const ShotLayerOverlayContext = createContext<ShotLayerOverlay | null>(null);

interface ShotLayerOverlayProviderProps {
  value: ShotLayerOverlay;
  children: ReactNode;
}

export function ShotLayerOverlayProvider({ value, children }: ShotLayerOverlayProviderProps) {
  return <ShotLayerOverlayContext.Provider value={value}>{children}</ShotLayerOverlayContext.Provider>;
}

/** Throws outside `<ShotLayerOverlayProvider>`; that is always a wiring bug. */
export function useShotLayerOverlay(): ShotLayerOverlay {
  const value = useContext(ShotLayerOverlayContext);
  if (!value) throw new Error('useShotLayerOverlay must be used inside <ShotLayerOverlayProvider>');
  return value;
}

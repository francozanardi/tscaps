import { createContext, useContext, type ReactNode } from 'react';
import type { SubtitleOverlayController } from '@presentation/editor/controllers/SubtitleOverlayController';

const OverlayControllerContext = createContext<SubtitleOverlayController | null>(null);

interface OverlayControllerProviderProps {
  value: SubtitleOverlayController;
  children: ReactNode;
}

export function OverlayControllerProvider({ value, children }: OverlayControllerProviderProps) {
  return <OverlayControllerContext.Provider value={value}>{children}</OverlayControllerContext.Provider>;
}

/**
 * Returns the overlay controller that owns imperative DOM writes
 * for time-driven className and CSS variables. Throws if used
 * outside the overlay subtree — that is always a wiring bug.
 */
export function useOverlayController(): SubtitleOverlayController {
  const value = useContext(OverlayControllerContext);
  if (!value) throw new Error('useOverlayController must be used inside <OverlayControllerProvider>');
  return value;
}

import { createContext, useContext, type ReactNode } from 'react';
import type { OverlaySelectionController } from '@presentation/editor/controllers/OverlaySelectionController';

const OverlaySelectionContext = createContext<OverlaySelectionController | null>(null);

interface OverlaySelectionProviderProps {
  value: OverlaySelectionController;
  children: ReactNode;
}

export function OverlaySelectionProvider({ value, children }: OverlaySelectionProviderProps) {
  return <OverlaySelectionContext.Provider value={value}>{children}</OverlaySelectionContext.Provider>;
}

/**
 * Returns the controller holding what is picked in the preview, for a
 * panel that picks something there on the user's request. Throws
 * outside `<OverlaySelectionProvider>`; that is always a wiring bug.
 */
export function useOverlaySelectionController(): OverlaySelectionController {
  const value = useContext(OverlaySelectionContext);
  if (!value) throw new Error('useOverlaySelectionController must be used inside <OverlaySelectionProvider>');
  return value;
}

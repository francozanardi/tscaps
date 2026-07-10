import { createContext, useContext, type ReactNode } from 'react';
import type { CutsEditingController } from '@presentation/cuts/controllers/CutsEditingController';

const CutsEditingControllerContext = createContext<CutsEditingController | null>(null);

interface CutsEditingControllerProviderProps {
  value: CutsEditingController;
  children: ReactNode;
}

export function CutsEditingControllerProvider({ value, children }: CutsEditingControllerProviderProps) {
  return (
    <CutsEditingControllerContext.Provider value={value}>
      {children}
    </CutsEditingControllerContext.Provider>
  );
}

/**
 * Returns the cuts editing controller provided by the closest
 * ancestor. Throws if mounted outside the provider; that is always a
 * wiring bug and should surface loudly.
 */
export function useCutsEditingController(): CutsEditingController {
  const value = useContext(CutsEditingControllerContext);
  if (!value) throw new Error('useCutsEditingController must be used inside <CutsEditingControllerProvider>');
  return value;
}

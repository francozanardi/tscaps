import { createContext, useContext, type ReactNode } from 'react';
import type { CutsWaveformController } from '@presentation/cuts/controllers/CutsWaveformController';

const CutsWaveformControllerContext = createContext<CutsWaveformController | null>(null);

interface CutsWaveformControllerProviderProps {
  value: CutsWaveformController;
  children: ReactNode;
}

export function CutsWaveformControllerProvider({ value, children }: CutsWaveformControllerProviderProps) {
  return (
    <CutsWaveformControllerContext.Provider value={value}>
      {children}
    </CutsWaveformControllerContext.Provider>
  );
}

/**
 * Returns the cuts waveform controller provided by the closest
 * ancestor. Throws if mounted outside the provider; that is always a
 * wiring bug and should surface loudly.
 */
export function useCutsWaveformController(): CutsWaveformController {
  const value = useContext(CutsWaveformControllerContext);
  if (!value) throw new Error('useCutsWaveformController must be used inside <CutsWaveformControllerProvider>');
  return value;
}

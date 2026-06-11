import { createContext, useContext, type ReactNode } from 'react';
import type { PreprocessingModule } from '@bootstrap/wiring/preprocessing';

const PreprocessingContext = createContext<PreprocessingModule | null>(null);

interface PreprocessingProviderProps {
  value: PreprocessingModule;
  children: ReactNode;
}

export function PreprocessingProvider({ value, children }: PreprocessingProviderProps) {
  return <PreprocessingContext.Provider value={value}>{children}</PreprocessingContext.Provider>;
}

/**
 * Returns the preprocessing module — the pipeline entry-point action
 * the start-video dialog drives. Throws if the consumer is mounted
 * outside `<PreprocessingProvider>`; that is always a wiring bug.
 */
export function usePreprocessing(): PreprocessingModule {
  const value = useContext(PreprocessingContext);
  if (!value) throw new Error('usePreprocessing must be used inside <PreprocessingProvider>');
  return value;
}

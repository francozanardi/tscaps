import { createContext, useContext, type ReactNode } from 'react';
import type { CaptionsModule } from '@bootstrap/wiring/captions';

const CaptionsContext = createContext<CaptionsModule | null>(null);

interface CaptionsProviderProps {
  value: CaptionsModule;
  children: ReactNode;
}

export function CaptionsProvider({ value, children }: CaptionsProviderProps) {
  return <CaptionsContext.Provider value={value}>{children}</CaptionsContext.Provider>;
}

/**
 * Returns the captions module — every action that shapes the captions
 * output (text edits, decoration management, style overrides,
 * structure changes, layout resets). Consumed by surfaces inside the
 * Captions mode: the Transcript subtab, the Layout subtab, and the
 * overlay popovers / manipulation controller. Throws if mounted
 * outside `<CaptionsProvider>`; that is always a wiring bug and
 * should surface loudly rather than fall back to a partial surface.
 */
export function useCaptions(): CaptionsModule {
  const value = useContext(CaptionsContext);
  if (!value) throw new Error('useCaptions must be used inside <CaptionsProvider>');
  return value;
}

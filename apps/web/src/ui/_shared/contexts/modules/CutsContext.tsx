import { createContext, useContext, useMemo, type ReactNode } from 'react';
import type { RenderTimeMap } from '@tscaps/engine';
import type { CutsModule } from '@bootstrap/wiring/cuts';
import { useEditorCuts } from '@ui/_shared/contexts/EditorStoreContext';

const CutsContext = createContext<CutsModule | null>(null);

interface CutsProviderProps {
  value: CutsModule;
  children: ReactNode;
}

export function CutsProvider({ value, children }: CutsProviderProps) {
  return <CutsContext.Provider value={value}>{children}</CutsContext.Provider>;
}

/**
 * Returns the cuts module — the add / removeAt actions that mutate
 * the editor store's cut registry. Throws if mounted outside
 * `<CutsProvider>`; that is always a wiring bug and should surface
 * loudly rather than fall back to a partial surface.
 */
export function useCuts(): CutsModule {
  const value = useContext(CutsContext);
  if (!value) throw new Error('useCuts must be used inside <CutsProvider>');
  return value;
}

/**
 * Returns the timeline mapper that translates between source video
 * time (the `<video>` element's clock, the times on every Word) and
 * output time (what the viewer sees once cuts collapse). Stable
 * across renders while the underlying cut registry is unchanged.
 */
export function useRenderTimeMap(): RenderTimeMap {
  const { renderTimeMapBuilder } = useCuts().services;
  const cuts = useEditorCuts();
  return useMemo(() => renderTimeMapBuilder.build(cuts), [renderTimeMapBuilder, cuts]);
}

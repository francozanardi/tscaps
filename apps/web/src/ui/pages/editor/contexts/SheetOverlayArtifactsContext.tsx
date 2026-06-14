import { createContext, useContext, type ReactNode } from 'react';
import type { SheetOverlayArtifactsBuilder } from '@presentation/editor/services/SheetOverlayArtifactsBuilder';

const SheetOverlayArtifactsContext = createContext<SheetOverlayArtifactsBuilder | null>(null);

interface SheetOverlayArtifactsProviderProps {
  value: SheetOverlayArtifactsBuilder;
  children: ReactNode;
}

export function SheetOverlayArtifactsProvider({ value, children }: SheetOverlayArtifactsProviderProps) {
  return <SheetOverlayArtifactsContext.Provider value={value}>{children}</SheetOverlayArtifactsContext.Provider>;
}

export function useSheetOverlayArtifactsBuilder(): SheetOverlayArtifactsBuilder {
  const value = useContext(SheetOverlayArtifactsContext);
  if (!value) throw new Error('useSheetOverlayArtifactsBuilder must be used inside <SheetOverlayArtifactsProvider>');
  return value;
}

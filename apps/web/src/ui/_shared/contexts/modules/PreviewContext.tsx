import { createContext, useContext, type ReactNode } from 'react';
import type { PreviewModule } from '@bootstrap/wiring/preview';

const PreviewContext = createContext<PreviewModule | null>(null);

interface PreviewProviderProps {
  value: PreviewModule;
  children: ReactNode;
}

export function PreviewProvider({ value, children }: PreviewProviderProps) {
  return <PreviewContext.Provider value={value}>{children}</PreviewContext.Provider>;
}

/**
 * Returns the preview module — the video preview surface that drives
 * editor playback. Throws when mounted outside `<PreviewProvider>`;
 * that is always a wiring bug and should surface loudly rather than
 * fall back to a partial surface.
 */
export function usePreview(): PreviewModule {
  const value = useContext(PreviewContext);
  if (!value) throw new Error('usePreview must be used inside <PreviewProvider>');
  return value;
}

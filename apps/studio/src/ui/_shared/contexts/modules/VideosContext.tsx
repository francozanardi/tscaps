import { createContext, useContext, type ReactNode } from 'react';
import type { VideosModule } from '@bootstrap/wiring/videos';

const VideosContext = createContext<VideosModule | null>(null);

interface VideosProviderProps {
  value: VideosModule;
  children: ReactNode;
}

export function VideosProvider({ value, children }: VideosProviderProps) {
  return <VideosContext.Provider value={value}>{children}</VideosContext.Provider>;
}

/**
 * Returns the videos module — custody of the source bytes the editor
 * exports from. Throws when mounted outside `<VideosProvider>`; that
 * is always a wiring bug and should surface loudly.
 */
export function useVideos(): VideosModule {
  const value = useContext(VideosContext);
  if (!value) throw new Error('useVideos must be used inside <VideosProvider>');
  return value;
}

import { createContext, useContext, type ReactNode } from 'react';
import type { MediaModule } from '@bootstrap/wiring/media';

const MediaContext = createContext<MediaModule | null>(null);

interface MediaProviderProps {
  value: MediaModule;
  children: ReactNode;
}

export function MediaProvider({ value, children }: MediaProviderProps) {
  return <MediaContext.Provider value={value}>{children}</MediaContext.Provider>;
}

/**
 * Returns the media module — the files a project holds besides its
 * video. Throws if mounted outside `<MediaProvider>`; that is always a
 * wiring bug and should surface loudly.
 */
export function useMedia(): MediaModule {
  const value = useContext(MediaContext);
  if (!value) throw new Error('useMedia must be used inside <MediaProvider>');
  return value;
}

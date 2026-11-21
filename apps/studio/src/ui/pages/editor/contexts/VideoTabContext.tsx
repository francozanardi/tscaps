import { createContext, useContext, type ReactNode } from 'react';
import type { VideoTabStore } from '@presentation/editor/stores/VideoTabStore';

const VideoTabStoreContext = createContext<VideoTabStore | null>(null);

interface VideoTabStoreProviderProps {
  value: VideoTabStore;
  children: ReactNode;
}

export function VideoTabStoreProvider({ value, children }: VideoTabStoreProviderProps) {
  return (
    <VideoTabStoreContext.Provider value={value}>
      {children}
    </VideoTabStoreContext.Provider>
  );
}

/**
 * Returns the Video-sidebar tab store provided by the closest
 * ancestor. Throws if mounted outside `<VideoTabStoreProvider>`;
 * that is always a wiring bug and should surface loudly.
 */
export function useVideoTabStore(): VideoTabStore {
  const value = useContext(VideoTabStoreContext);
  if (!value) throw new Error('useVideoTabStore must be used inside <VideoTabStoreProvider>');
  return value;
}

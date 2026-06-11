import { createContext, useContext, type ReactNode } from 'react';

/**
 * `MediaStream` of the editor's main `<video>`; `null` when no
 * consumer needs it (no sheet opts into `previewMode: 'live'`) or
 * no video is mounted.
 */
const MainVideoStreamContext = createContext<MediaStream | null>(null);

interface MainVideoStreamProviderProps {
  value: MediaStream | null;
  children: ReactNode;
}

export function MainVideoStreamProvider({ value, children }: MainVideoStreamProviderProps) {
  return <MainVideoStreamContext.Provider value={value}>{children}</MainVideoStreamContext.Provider>;
}

export function useMainVideoStream(): MediaStream | null {
  return useContext(MainVideoStreamContext);
}

import { createContext, useContext, type ReactNode } from 'react';
import type { PreviewStreams } from '@presentation/editor/controllers/PreviewStreamsCaptureController';

/**
 * The preview's pictures as streams; `null` when no consumer needs
 * them (no sheet opts into `previewMode: 'live'`) or no video is
 * mounted.
 */
const PreviewStreamsContext = createContext<PreviewStreams | null>(null);

interface PreviewStreamsProviderProps {
  value: PreviewStreams | null;
  children: ReactNode;
}

export function PreviewStreamsProvider({ value, children }: PreviewStreamsProviderProps) {
  return <PreviewStreamsContext.Provider value={value}>{children}</PreviewStreamsContext.Provider>;
}

export function usePreviewStreams(): PreviewStreams | null {
  return useContext(PreviewStreamsContext);
}

import { createContext, useContext, type ReactNode } from 'react';
import type { OutputFrameModule } from '@bootstrap/wiring/output-frame';

const OutputFrameContext = createContext<OutputFrameModule | null>(null);

interface OutputFrameProviderProps {
  value: OutputFrameModule;
  children: ReactNode;
}

export function OutputFrameProvider({ value, children }: OutputFrameProviderProps) {
  return <OutputFrameContext.Provider value={value}>{children}</OutputFrameContext.Provider>;
}

/**
 * Returns the output frame module — what changes the shape the video is
 * exported in. Throws if mounted outside `<OutputFrameProvider>`; that
 * is always a wiring bug and should surface loudly.
 */
export function useOutputFrame(): OutputFrameModule {
  const value = useContext(OutputFrameContext);
  if (!value) throw new Error('useOutputFrame must be used inside <OutputFrameProvider>');
  return value;
}

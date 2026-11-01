import { createContext, useContext, type ReactNode } from 'react';
import type { RestingCaptionProbe } from '@presentation/editor/services/RestingCaptionProbe';

const RestingCaptionProbeContext = createContext<RestingCaptionProbe | null>(null);

interface RestingCaptionProbeProviderProps {
  value: RestingCaptionProbe;
  children: ReactNode;
}

export function RestingCaptionProbeProvider({ value, children }: RestingCaptionProbeProviderProps) {
  return <RestingCaptionProbeContext.Provider value={value}>{children}</RestingCaptionProbeContext.Provider>;
}

/** The editor's probe, or `null` outside an editor, where fields answer from what was configured. */
export function useRestingCaptionProbe(): RestingCaptionProbe | null {
  return useContext(RestingCaptionProbeContext);
}

import { createContext, useContext, type ReactNode } from 'react';
import type { TranscriptionModule } from '@bootstrap/wiring/transcription';

const TranscriptionContext = createContext<TranscriptionModule | null>(null);

interface TranscriptionProviderProps {
  value: TranscriptionModule;
  children: ReactNode;
}

export function TranscriptionProvider({ value, children }: TranscriptionProviderProps) {
  return <TranscriptionContext.Provider value={value}>{children}</TranscriptionContext.Provider>;
}

/**
 * Returns the transcription module. Throws if the consumer is
 * mounted outside `<TranscriptionProvider>`; that is always a wiring
 * bug and should surface loudly rather than fall back to a stale or
 * partial surface.
 */
export function useTranscription(): TranscriptionModule {
  const value = useContext(TranscriptionContext);
  if (!value) throw new Error('useTranscription must be used inside <TranscriptionProvider>');
  return value;
}

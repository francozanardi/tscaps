import { createContext, useContext, type ReactNode } from 'react';
import type { AudioMixModule } from '@bootstrap/wiring/audio-mix';

const AudioMixContext = createContext<AudioMixModule | null>(null);

interface AudioMixProviderProps {
  value: AudioMixModule;
  children: ReactNode;
}

export function AudioMixProvider({ value, children }: AudioMixProviderProps) {
  return <AudioMixContext.Provider value={value}>{children}</AudioMixContext.Provider>;
}

/**
 * Returns the audio mix module — the project's soundtrack: its music,
 * its sound effects and the video's own level. Throws if mounted
 * outside `<AudioMixProvider>`; that is always a wiring bug and should
 * surface loudly.
 */
export function useAudioMix(): AudioMixModule {
  const value = useContext(AudioMixContext);
  if (!value) throw new Error('useAudioMix must be used inside <AudioMixProvider>');
  return value;
}

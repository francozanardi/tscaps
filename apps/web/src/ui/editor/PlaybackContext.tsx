import { createContext, useContext, type ReactNode } from 'react';
import type { PlaybackActions } from '@ui/editor/EditorPageActions';

const PlaybackContext = createContext<PlaybackActions | null>(null);

interface PlaybackProviderProps {
  value: PlaybackActions;
  children: ReactNode;
}

export function PlaybackProvider({ value, children }: PlaybackProviderProps) {
  return <PlaybackContext.Provider value={value}>{children}</PlaybackContext.Provider>;
}

/**
 * Returns the playback callbacks bound to the editor's video element.
 * Each method tolerates the video not being mounted yet (no-op).
 * Throws if used outside `<PlaybackProvider>` — that is always a
 * wiring bug.
 */
export function usePlayback(): PlaybackActions {
  const value = useContext(PlaybackContext);
  if (!value) throw new Error('usePlayback must be used inside <PlaybackProvider>');
  return value;
}

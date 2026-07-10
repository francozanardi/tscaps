import { createContext, useContext, type ReactNode } from 'react';

export interface PlaybackActions {
  togglePlay: () => void;
  play: () => void;
  pause: () => void;
  seek: (time: number) => void;
  beginScrub: () => void;
  endScrub: () => void;
  setVolume: (vol: number) => void;
  setPlaybackRate: (rate: number) => void;
  prevFrame: () => void;
  nextFrame: () => void;
  prevWord: () => void;
  nextWord: () => void;
  prevSegment: () => void;
  nextSegment: () => void;
  /**
   * Schedule the audio output to drop to silence the moment the
   * playhead reaches the given source-time position. Replaces any
   * pending schedule.
   */
  scheduleAudioMuteAt: (sourceTimeSec: number) => void;
  cancelScheduledAudioMute: () => void;
}

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

import { useCallback, useMemo, useSyncExternalStore } from 'react';
import type { AudioSourceRef } from '@core/audio-mix/domain/AudioSourceRef';
import { useSoundAuditionPlayer } from '@ui/pages/editor/features/audio/hooks/useSoundAuditionPlayer';

export interface SoundAudition {
  /** Whether `source` is the sound playing, or about to. */
  isPlaying: (source: AudioSourceRef) => boolean;
  /** Plays `source`, stopping whatever else plays; stops it where it is the one playing. */
  toggle: (source: AudioSourceRef) => void;
}

/**
 * One file at a time, heard as it is before it is picked, for the
 * caller's lifetime: whatever plays stops when the caller unmounts.
 */
export function useSoundAudition(): SoundAudition {
  const player = useSoundAuditionPlayer();
  const subscribe = useCallback((listener: () => void) => player.subscribe(listener), [player]);
  const playingKey = useSyncExternalStore(subscribe, () => player.playingKey());
  return useMemo(() => ({
    isPlaying: (source) => playingKey === player.keyOf(source),
    toggle: (source) => player.toggle(source),
  }), [player, playingKey]);
}

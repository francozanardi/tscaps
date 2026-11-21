import { useCallback, useEffect, useMemo, useSyncExternalStore } from 'react';
import type { AudioClip } from '@core/audio-mix/domain/AudioClip';
import { useSoundAuditionPlayer } from '@ui/pages/editor/features/audio/hooks/useSoundAuditionPlayer';

export interface ClipAudition {
  /** Whether `clip` is the sound playing, or about to. */
  isPlaying: (clip: AudioClip) => boolean;
  /** Plays `clip` as it is placed, stopping whatever else plays; stops it where it is the one playing. */
  toggle: (clip: AudioClip) => void;
}

/**
 * One clip at a time, heard as it is placed (from its in-point, at its
 * volume) for the caller's lifetime. While one plays it follows `clips`:
 * a volume dragged changes what is heard, and a clip removed or given
 * another file stops.
 */
export function useClipAudition(clips: ReadonlyArray<AudioClip>): ClipAudition {
  const player = useSoundAuditionPlayer();
  const subscribe = useCallback((listener: () => void) => player.subscribe(listener), [player]);
  const playingKey = useSyncExternalStore(subscribe, () => player.playingKey());
  useEffect(() => player.follow(clips), [player, clips]);
  return useMemo(() => ({
    isPlaying: (clip) => playingKey === player.clipKeyOf(clip),
    toggle: (clip) => player.toggleClip(clip),
  }), [player, playingKey]);
}

import { useMemo } from 'react';
import { ShotPlaybackController } from '@presentation/shots/controllers/ShotPlaybackController';
import { usePlayback } from '@ui/pages/editor/contexts/PlaybackContext';

/** Plays one shot, aloud, and comes to rest on its last frame. */
export function useShotPlayback(): ShotPlaybackController {
  const playback = usePlayback();
  return useMemo(
    () => new ShotPlaybackController(
      playback.seek,
      playback.play,
      playback.scheduleStopAt,
      playback.cancelScheduledAudioMute,
    ),
    [playback],
  );
}

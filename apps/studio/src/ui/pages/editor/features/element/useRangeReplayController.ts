import { useMemo } from 'react';
import { RangeReplayController } from '@presentation/editor/controllers/RangeReplayController';
import { usePlayback } from '@ui/pages/editor/contexts/PlaybackContext';
import { useEditorStore } from '@ui/_shared/contexts/EditorStoreContext';

/** A {@link RangeReplayController} on the editor's playback, for the caller's lifetime. */
export function useRangeReplayController(): RangeReplayController {
  const playback = usePlayback();
  const store = useEditorStore();
  return useMemo(
    () => new RangeReplayController(
      {
        // Read where it is asked for rather than subscribed to: a panel
        // that re-rendered on every tick to hold a value it only reads
        // on a click would cost far more than the click.
        isPlaying: () => store.snapshot().video.isPlaying,
        timeSec: () => store.snapshot().video.currentTime,
      },
      playback.seek,
      playback.play,
      playback.scheduleStopAt,
      playback.scheduleAudioMuteAt,
      playback.cancelScheduledAudioMute,
    ),
    [playback, store],
  );
}

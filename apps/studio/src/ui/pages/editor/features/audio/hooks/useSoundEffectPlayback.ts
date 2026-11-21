import { useCallback, useMemo } from 'react';
import type { AudioEffectRow } from '@presentation/audio-mix/services/AudioTabPresenter';
import { SoundEffectPlaybackController } from '@presentation/audio-mix/controllers/SoundEffectPlaybackController';
import { useEditorStore } from '@ui/_shared/contexts/EditorStoreContext';
import { useAudioMix } from '@ui/_shared/contexts/modules/AudioMixContext';
import { useRenderTimeMap } from '@ui/_shared/contexts/modules/CutsContext';
import { usePlayback } from '@ui/pages/editor/contexts/PlaybackContext';

/**
 * Plays the video around an effect, aloud, over the stretch the preview
 * plays it, or stops that playback when asked again while it runs. An
 * effect the preview does not play yet (its file still being read) only
 * moves the playhead to where it lands.
 */
export function useSoundEffectPlayback(): (row: AudioEffectRow) => void {
  const playback = usePlayback();
  const store = useEditorStore();
  const { preview } = useAudioMix();
  const timeMap = useRenderTimeMap();
  const controller = useMemo(
    () => new SoundEffectPlaybackController(
      {
        // Read when pressed rather than subscribed to, so the list does not re-render on every tick of the playhead.
        isPlaying: () => store.snapshot().video.isPlaying,
        timeSec: () => store.snapshot().video.currentTime,
      },
      playback.seek,
      playback.play,
      playback.pause,
      playback.scheduleStopAt,
      playback.cancelScheduledAudioMute,
    ),
    [playback, store],
  );
  return useCallback((row: AudioEffectRow) => {
    const layer = preview.snapshot()?.layers.find((candidate) => candidate.id === row.clip.id);
    if (layer !== undefined) {
      controller.toggle(row.clip.id, { startSec: layer.outputStartSec, endSec: layer.outputEndSec }, timeMap);
    } else if (row.seekSourceSec !== null) {
      playback.seek(row.seekSourceSec);
    }
  }, [controller, preview, timeMap, playback]);
}

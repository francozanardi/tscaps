import { useCallback, useMemo } from 'react';
import { ShotLayerReplayRangeResolver } from '@presentation/shots/services/ShotLayerReplayRangeResolver';
import { useEditor } from '@ui/_shared/contexts/modules/EditorContext';
import { useRenderTimeMap } from '@ui/_shared/contexts/modules/CutsContext';
import { useShots } from '@ui/_shared/contexts/modules/ShotsContext';
import { useRangeReplay } from '@ui/pages/editor/features/element/useRangeReplay';
import { useMediaAssets } from '@ui/pages/editor/features/media/hooks/useMediaAssets';

/**
 * Plays the layer `layerId` once over its whole stretch, from the moment
 * it comes in to its last frame, silent unless a sound is anchored to it.
 * Does nothing while the user is playing the video, or for a layer that no
 * longer shows. The shots are read when it is called, so a change just
 * made is what plays.
 */
export function useShotLayerWholeReplay(layerId: string): () => void {
  const store = useEditor().store;
  const media = useMediaAssets();
  const timeMap = useRenderTimeMap();
  const { layerTiming } = useShots().services;
  const replayRange = useRangeReplay();
  const resolver = useMemo(() => new ShotLayerReplayRangeResolver(layerTiming), [layerTiming]);

  return useCallback(() => {
    const { shots, video, audio } = store.snapshot();
    const range = resolver.wholeOf(layerId, shots, media, timeMap, video.duration);
    if (range === null) return;
    const sounds = audio.clips().some(({ role, start: { anchor } }) => role === 'effect'
      && (anchor.kind === 'layer' || anchor.kind === 'layer-transition' || anchor.kind === 'layer-moment') && anchor.layerId === layerId);
    replayRange(range.startSec, range.endSec, sounds);
  }, [store, resolver, layerId, media, timeMap, replayRange]);
}

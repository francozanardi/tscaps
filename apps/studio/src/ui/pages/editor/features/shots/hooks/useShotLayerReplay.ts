import { useCallback, useMemo } from 'react';
import { DecorationOverrideRegistry } from '@core/captions/domain/DecorationOverrideRegistry';
import { ElementAnimationScope } from '@core/elements/domain/ElementAnimationScope';
import type { ShotLayerAnimationScope } from '@core/shots/actions/SetShotLayerAnimationAction';
import { ShotLayerReplayRangeResolver } from '@presentation/shots/services/ShotLayerReplayRangeResolver';
import { useEditor } from '@ui/_shared/contexts/modules/EditorContext';
import { useRenderTimeMap } from '@ui/_shared/contexts/modules/CutsContext';
import { useShots } from '@ui/_shared/contexts/modules/ShotsContext';
import { useRangeReplay } from '@ui/pages/editor/features/element/useRangeReplay';
import { useMediaAssets } from '@ui/pages/editor/features/media/hooks/useMediaAssets';
import { useShotLayerMotionForm } from '@ui/pages/editor/features/shots/hooks/useShotLayerMotionForm';
import { useAudioMix } from '@ui/_shared/contexts/modules/AudioMixContext';

/**
 * Plays one end of the layer `layerId` once: its entrance from
 * the moment it comes in, or its exit up to its last frame, for as long
 * as that end moves — its motion, or the split's line or the box's
 * transition where that takes longer — and a moment more. Silent, unless that end plays a
 * sound (the layer's own as it enters or exits, or its layout
 * transition's): then with it, starting early enough to take it in,
 * since the end is judged as it will be heard. Does nothing while the user is playing the
 * video, or for a layer that no longer shows. The shots and the video's
 * length are read when it is called, not subscribed to, so a change
 * just made is what plays.
 */
export function useShotLayerReplay(layerId: string): (scope: ShotLayerAnimationScope) => void {
  const store = useEditor().store;
  const media = useMediaAssets();
  const timeMap = useRenderTimeMap();
  const { layerTiming, splitTransitions, insetTransitions } = useShots().services;
  const form = useShotLayerMotionForm();
  const replayRange = useRangeReplay();
  const audioTiming = useAudioMix().services.timing;
  const resolver = useMemo(() => new ShotLayerReplayRangeResolver(layerTiming), [layerTiming]);

  return useCallback((scope: ShotLayerAnimationScope) => {
    const { shots, video } = store.snapshot();
    const edge = scope === ElementAnimationScope.ENTRANCE ? 'entrance' : 'exit';
    const fields = shots.layerStyles.get(layerId)?.fields;
    const motionSec = form.durationSec(shots.layerStyles.animationOf(layerId, scope) ?? undefined);
    const layout = shots.placementOf(layerId).kind;
    const splits = layout === 'split' && splitTransitions.kindOf(fields, edge) !== 'cut';
    const floats = layout === 'inset' && insetTransitions.kindOf(fields, edge) !== 'cut';
    const edgeSec = Math.max(
      motionSec,
      splits ? splitTransitions.durationSecOf(fields, edge) : 0,
      floats ? insetTransitions.durationSecOf(fields, edge) : 0,
    );
    const range = resolver.resolve(layerId, edge, edgeSec, shots, media, timeMap, video.duration);
    if (range === null) return;
    const layerEdge = edge === 'entrance' ? 'entry' : 'exit';
    const sounds = store.snapshot().audio.clips().filter(({ role, start: { anchor } }) => role === 'effect'
      && ((anchor.kind === 'layer' && anchor.layerId === layerId && anchor.edge === layerEdge)
        || (anchor.kind === 'layer-transition' && anchor.layerId === layerId && anchor.edge === edge)));
    // Only the layer's own sounds are read, so no captions are needed.
    const context = {
      originalDocument: null,
      originalSheets: [],
      originalDecorationOverrides: DecorationOverrideRegistry.empty(),
      shots,
      media,
      timeMap,
      videoDurationSec: video.duration,
    };
    const startsSec = sounds.flatMap(({ start }) => {
      const landing = audioTiming.resolve(start, context);
      return landing.kind === 'gone' ? [] : [timeMap.toSourceTime(Math.max(0, landing.outputSec))];
    });
    replayRange(Math.min(range.startSec, ...startsSec), range.endSec, sounds.length > 0);
  }, [store, resolver, layerId, form, splitTransitions, insetTransitions, media, timeMap, replayRange, audioTiming]);
}

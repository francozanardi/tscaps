import { useCallback, useMemo } from 'react';
import { ShotVideoLayerId } from '@core/shots/domain/ShotVideoLayerId';
import { ShotLayerReplayRangeResolver } from '@presentation/shots/services/ShotLayerReplayRangeResolver';
import { useEditor } from '@ui/_shared/contexts/modules/EditorContext';
import { useRenderTimeMap } from '@ui/_shared/contexts/modules/CutsContext';
import { useShots } from '@ui/_shared/contexts/modules/ShotsContext';
import type { InspectedElement } from '@ui/pages/editor/features/element/useInspectedElement';
import { useRangeReplayController } from '@ui/pages/editor/features/element/useRangeReplayController';
import { useMediaAssets } from '@ui/pages/editor/features/media/hooks/useMediaAssets';

/** Playing the element being edited from its start: what the way is called, and taking it. */
export interface InspectedElementPlay {
  /** `Play word`, `Play b-roll`, `Play shot`: the element as the header names its kind. */
  readonly label: string;
  readonly play: () => void;
}

// A scene is painted over a half-open window, so its own end is the
// first instant it is gone, and the inspector's pick with it. A sixtieth
// is the shortest frame the editor assumes anywhere.
const LAST_PAINTED_FRAME_SEC = 1 / 60;

/**
 * Plays the element being edited once, from its start to its end, with
 * sound, and comes to rest on its last frame: a caption element over its
 * own window (a word while it is said, a scene while it shows), a layer
 * or a shot over its whole stretch. It takes the playhead whatever the
 * video was doing, since the user asked for this element by name, and
 * it is also the way back to an element off screen.
 *
 * Null for several layers edited together, which have no one stretch.
 * What plays is read when it is asked for, so an edit just made is what
 * plays.
 */
export function useInspectedElementPlay(element: InspectedElement | null): InspectedElementPlay | null {
  const store = useEditor().store;
  const media = useMediaAssets();
  const timeMap = useRenderTimeMap();
  const { layerTiming } = useShots().services;
  const controller = useRangeReplayController();
  const resolver = useMemo(() => new ShotLayerReplayRangeResolver(layerTiming), [layerTiming]);

  const rangeOf = useCallback((target: InspectedElement): { startSec: number; endSec: number } | null => {
    switch (target.kind) {
      case 'shot-layers': return null;
      case 'shot-layer':
      case 'shot': {
        const { shots, video } = store.snapshot();
        const layerId = target.kind === 'shot' ? ShotVideoLayerId.of(target.shotId) : target.id;
        return resolver.wholeOf(layerId, shots, media, timeMap, video.duration);
      }
      default:
        return { startSec: target.startsAt, endSec: Math.min(target.endsAt, target.sceneEndsAt - LAST_PAINTED_FRAME_SEC) };
    }
  }, [store, resolver, media, timeMap]);

  return useMemo(() => {
    if (element === null || element.kind === 'shot-layers') return null;
    return {
      label: `Play ${element.kindLabel.toLowerCase()}`,
      play: () => {
        const range = rangeOf(element);
        if (range !== null) controller.playThrough(range.startSec, range.endSec);
      },
    };
  }, [element, rangeOf, controller]);
}

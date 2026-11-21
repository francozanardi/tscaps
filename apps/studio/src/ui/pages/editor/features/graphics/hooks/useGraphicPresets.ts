import { useCallback, useMemo, useSyncExternalStore } from 'react';
import type { GraphicPreset } from '@core/graphics/domain/GraphicPreset';
import { useShots } from '@ui/_shared/contexts/modules/ShotsContext';

/** Every preset a graphic can start from, the user's saved ones first, re-read as one is saved, renamed or deleted. */
export function useGraphicPresets(): ReadonlyArray<GraphicPreset> {
  const { graphicPresets, graphicPresetLibrary } = useShots().services;
  const saved = useSyncExternalStore(
    useCallback((listener: () => void) => graphicPresetLibrary.store.subscribe(listener), [graphicPresetLibrary]),
    () => graphicPresetLibrary.store.snapshot(),
  );
  return useMemo(() => graphicPresets.list(), [graphicPresets, saved]);
}

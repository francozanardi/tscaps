import { useCallback, useSyncExternalStore } from 'react';
import type { GraphicPreset } from '@core/graphics/domain/GraphicPreset';
import type { GraphicPresetThumbnail } from '@core/graphics/store/GraphicPresetThumbnailStore';
import { useShots } from '@ui/_shared/contexts/modules/ShotsContext';

/** Where `preset`'s looping thumbnail stands, asking for it the first time and re-read as it lands. */
export function useGraphicPresetThumbnail(preset: GraphicPreset): GraphicPresetThumbnail {
  const thumbnails = useShots().services.graphicPresetThumbnails;
  const read = useCallback(() => thumbnails.thumbnailOf(preset), [thumbnails, preset]);
  return useSyncExternalStore(useCallback((listener) => thumbnails.subscribe(listener), [thumbnails]), read, read);
}

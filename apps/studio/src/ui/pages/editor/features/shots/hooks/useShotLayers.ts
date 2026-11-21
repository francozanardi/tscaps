import { useMemo } from 'react';
import type { ShotFileLayer, ShotGraphicLayer, ShotLayer } from '@core/shots/domain/ShotLayer';
import type { ShotPictureLayer } from '@core/shots/domain/ShotPictureLayer';
import { useShots } from '@ui/_shared/contexts/modules/ShotsContext';
import { useMediaAssets } from '@ui/pages/editor/features/media/hooks/useMediaAssets';

/**
 * What a shot shows, by role: its b-roll, the pictures and GIFs on top,
 * the graphics above them, and the layers whose file is gone, each
 * bottom to top.
 */
export interface ShotLayersByRole {
  readonly broll: ShotFileLayer | null;
  readonly pictures: readonly ShotPictureLayer[];
  readonly graphics: readonly ShotGraphicLayer[];
  /** Layers naming a file the open project's files do not hold, so of no known role. */
  readonly missing: readonly ShotFileLayer[];
}

/** Sorts a shot's layers by what their files are, re-reading when the files change. */
export function useShotLayers(layers: readonly ShotLayer[]): ShotLayersByRole {
  const { services } = useShots();
  const media = useMediaAssets();
  return useMemo(() => ({
    broll: services.layerAssets.videoLayerOf(layers, media),
    pictures: services.layerAssets.pictureLayersOf(layers, media),
    graphics: services.layerAssets.graphicLayersOf(layers),
    missing: services.layerAssets.missingLayersOf(layers, media),
  }), [services, layers, media]);
}

import { useMemo } from 'react';
import type { ShotLayerAsset } from '@core/shots/domain/ScheduledShotLayer';
import type { ShotLayer } from '@core/shots/domain/ShotLayer';
import { useShots } from '@ui/_shared/contexts/modules/ShotsContext';
import { useMediaAssets } from '@ui/pages/editor/features/media/hooks/useMediaAssets';

/** A layer an earlier shot holds that a shot still shows, with what it is. */
export interface ContinuingShotLayer {
  readonly layer: ShotLayer;
  readonly kind: ShotLayerAsset['kind'];
}

/**
 * The layers continuing into a shot that there is something to show
 * of, bottom to top, each with what it is, re-reading when the files
 * change. A layer whose file is gone draws nothing and is left out: it
 * is seen, and removed, on the shot that holds it.
 */
export function useContinuingShotLayers(layers: readonly ShotLayer[]): readonly ContinuingShotLayer[] {
  const { services } = useShots();
  const media = useMediaAssets();
  return useMemo(() => layers.flatMap((layer) => {
    const kind = services.layerAssets.assetOf(layer, media)?.kind;
    return kind === undefined ? [] : [{ layer, kind }];
  }), [services, layers, media]);
}

import type { ShotLayerRole } from '@core/shots/domain/ShotLayerRole';
import { useShots } from '@ui/_shared/contexts/modules/ShotsContext';
import { useMediaAssets } from '@ui/pages/editor/features/media/hooks/useMediaAssets';

/**
 * What a layer showing the file is for — a b-roll, or a picture or GIF
 * on top — or null while the file is not known, or for no file at all
 * (a graphic), re-read as files come and go.
 */
export function useShotLayerRole(mediaId: string | null): ShotLayerRole | null {
  const { services } = useShots();
  const catalog = useMediaAssets();
  return mediaId === null ? null : services.layerAssets.roleOf(mediaId, catalog);
}

import { useCallback, useSyncExternalStore } from 'react';
import type { MediaAssetCatalog } from '@core/media/domain/MediaAssetCatalog';
import { useMedia } from '@ui/_shared/contexts/modules/MediaContext';

/** The media files the open project can use — its own and the library — re-rendering when the list changes. */
export function useMediaAssets(): MediaAssetCatalog {
  const { assets } = useMedia();
  const subscribe = useCallback((listener: () => void) => {
    assets.addEventListener('change', listener);
    return () => assets.removeEventListener('change', listener);
  }, [assets]);
  return useSyncExternalStore(subscribe, () => assets.snapshot());
}

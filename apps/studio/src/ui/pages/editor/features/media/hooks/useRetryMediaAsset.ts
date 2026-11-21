import { useCallback } from 'react';
import { useMedia } from '@ui/_shared/contexts/modules/MediaContext';

/**
 * Tries again whatever of a media file failed: making it ready, and
 * sending it up. Does nothing for a file the open project cannot use.
 */
export function useRetryMediaAsset(): (assetId: string) => void {
  const { assets, preparer, uploader } = useMedia();
  return useCallback((assetId: string) => {
    const asset = assets.snapshot().get(assetId);
    if (!asset) return;
    if (preparer.statusOf(assetId)?.phase === 'failed') void preparer.prepare(asset);
    uploader.retry(assetId);
  }, [assets, preparer, uploader]);
}

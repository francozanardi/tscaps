import { useCallback, useSyncExternalStore } from 'react';
import { useMedia } from '@ui/_shared/contexts/modules/MediaContext';

/**
 * What `assetId` is previewed through — a video's proxy, a picture's
 * own file — once it is ready and has been read; null before that, and
 * for no asset. Asking starts the read.
 */
export function useMediaAssetProxy(projectId: string | null, assetId: string | null): Blob | null {
  const { preparer, proxyCache } = useMedia();
  const subscribe = useCallback((listener: () => void) => {
    const unsubscribePreparer = preparer.subscribe(listener);
    const unsubscribeCache = proxyCache.subscribe(listener);
    return () => {
      unsubscribePreparer();
      unsubscribeCache();
    };
  }, [preparer, proxyCache]);
  const read = useCallback(() => {
    if (assetId === null || preparer.statusOf(assetId)?.phase !== 'ready') return null;
    return proxyCache.proxyOf(projectId, assetId);
  }, [preparer, proxyCache, projectId, assetId]);
  return useSyncExternalStore(subscribe, read);
}

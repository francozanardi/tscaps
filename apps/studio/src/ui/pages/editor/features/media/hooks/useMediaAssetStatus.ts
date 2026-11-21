import { useCallback, useSyncExternalStore } from 'react';
import type { MediaAssetStatus } from '@presentation/media/services/MediaAssetStatusPresenter';
import { useMedia } from '@ui/_shared/contexts/modules/MediaContext';
import { useMediaAssets } from '@ui/pages/editor/features/media/hooks/useMediaAssets';

/** Where one media file stands, re-rendering on every change. */
export function useMediaAssetStatus(assetId: string): MediaAssetStatus {
  const { preparer, uploader } = useMedia();
  const type = useMediaAssets().get(assetId)?.type ?? null;
  const subscribePreparation = useCallback((listener: () => void) => preparer.subscribe(listener), [preparer]);
  const subscribeUpload = useCallback((listener: () => void) => uploader.subscribe(listener), [uploader]);
  const preparation = useSyncExternalStore(subscribePreparation, () => preparer.statusOf(assetId));
  const upload = useSyncExternalStore(subscribeUpload, () => uploader.statusOf(assetId, 'original'));
  return { exists: type !== null, type, preparation, upload };
}

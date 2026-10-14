import { useEffect, useState } from 'react';
import type { PersonSegmentationResult } from '@core/person-segmentation/domain/PersonSegmentationResult';
import type { LoadedPersonSegmentationCacheStore } from '@core/person-segmentation/store/LoadedPersonSegmentationCacheStore';

/** The detector result loaded for the current project, or `null` while none is. Follows the store's slot as it changes. */
export function useLoadedDetectorResult(store: LoadedPersonSegmentationCacheStore): PersonSegmentationResult | null {
  const [result, setResult] = useState<PersonSegmentationResult | null>(() => store.current?.result ?? null);
  useEffect(() => {
    const update = (): void => setResult(store.current?.result ?? null);
    store.addEventListener('change', update);
    update();
    return () => store.removeEventListener('change', update);
  }, [store]);
  return result;
}

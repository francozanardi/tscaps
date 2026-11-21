import { useCallback, useMemo, useSyncExternalStore } from 'react';
import type { FootageCover } from '@core/person-segmentation/domain/FootageCoverage';
import { useEditorStore } from '@ui/_shared/contexts/EditorStoreContext';
import { usePersonSegmentation } from '@ui/_shared/contexts/modules/PersonSegmentationContext';
import { useMediaAssets } from '@ui/pages/editor/features/media/hooks/useMediaAssets';

/**
 * Where other footage covers the video, and which layer covers it,
 * which the text-behind-actor effect never runs over. Re-renders only
 * when what decides it changes, never on a playback tick.
 */
export function useFootageCovers(): ReadonlyArray<FootageCover> {
  const store = useEditorStore();
  const { footageCoverage } = usePersonSegmentation();
  const subscribe = useCallback((listener: () => void) => {
    store.addEventListener('change', listener);
    return () => store.removeEventListener('change', listener);
  }, [store]);
  const shots = useSyncExternalStore(subscribe, () => store.snapshot().shots);
  const media = useMediaAssets();
  const cuts = useSyncExternalStore(subscribe, () => store.snapshot().cuts);
  const durationSec = useSyncExternalStore(subscribe, () => store.snapshot().video.duration);
  return useMemo(
    () => footageCoverage.covers({ shots, media, cuts, videoDurationSec: durationSec > 0 ? durationSec : null }),
    [footageCoverage, shots, media, cuts, durationSec],
  );
}

import { useEffect, useState } from 'react';
import { usePersonSegmentation } from '@ui/_shared/contexts/modules/PersonSegmentationContext';

/** Whether an on-demand actor-mask computation is running for `segmentId`. */
export function useSegmentMaskBackfillPending(segmentId: string): boolean {
  const { segmentMaskBackfillStore } = usePersonSegmentation();
  const [pending, setPending] = useState<boolean>(() => segmentMaskBackfillStore.isPending(segmentId));

  useEffect(() => {
    const update = (): void => setPending(segmentMaskBackfillStore.isPending(segmentId));
    segmentMaskBackfillStore.addEventListener('change', update);
    update();
    return () => segmentMaskBackfillStore.removeEventListener('change', update);
  }, [segmentMaskBackfillStore, segmentId]);

  return pending;
}

import { useEffect, useState } from 'react';
import { usePersonSegmentation } from '@ui/_shared/contexts/modules/PersonSegmentationContext';

/** Whether any segment currently has an on-demand actor-mask computation running. */
export function useAnyMaskBackfillPending(): boolean {
  const { segmentMaskBackfillStore } = usePersonSegmentation();
  const [pending, setPending] = useState<boolean>(() => segmentMaskBackfillStore.hasAnyPending());

  useEffect(() => {
    const update = (): void => setPending(segmentMaskBackfillStore.hasAnyPending());
    segmentMaskBackfillStore.addEventListener('change', update);
    update();
    return () => segmentMaskBackfillStore.removeEventListener('change', update);
  }, [segmentMaskBackfillStore]);

  return pending;
}

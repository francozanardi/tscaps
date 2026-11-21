import { useCallback, useSyncExternalStore } from 'react';
import type { ReviewMarkingSnapshot, ReviewMarkingStore } from '@presentation/review-notes/stores/ReviewMarkingStore';

/** The frame's marking mode, re-rendering when it changes. */
export function useReviewMarking(store: ReviewMarkingStore): ReviewMarkingSnapshot {
  const subscribe = useCallback((notify: () => void) => {
    store.addEventListener('change', notify);
    return () => store.removeEventListener('change', notify);
  }, [store]);
  return useSyncExternalStore(subscribe, () => store.snapshot());
}

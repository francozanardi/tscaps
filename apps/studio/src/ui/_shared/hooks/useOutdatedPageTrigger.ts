import { useCallback, useSyncExternalStore } from 'react';
import type { OutdatedPageTrigger } from '@core/_shared/infrastructure/IndexedDbClient';
import { useUtils } from '@ui/_shared/contexts/modules/UtilsContext';

/**
 * How this tab found out that it runs an older version of the app than
 * the one already used in this browser, or `null` while it has not.
 * Re-renders the caller when that changes, which happens at most once
 * per page load.
 */
export function useOutdatedPageTrigger(): OutdatedPageTrigger | null {
  const { indexedDb } = useUtils();
  const subscribe = useCallback((notify: () => void) => indexedDb.onPageOutdated(notify), [indexedDb]);
  return useSyncExternalStore(subscribe, () => indexedDb.outdatedPageTrigger());
}

import { useCallback, useSyncExternalStore } from 'react';
import type { ShotPartition } from '@core/shots/domain/ShotPartition';
import { useEditorStore } from '@ui/_shared/contexts/EditorStoreContext';

// A seek to where a shot opens comes back through source → output →
// source time, and floating point can land it a hair early — on the
// shot before the one that was asked for.
const ROUND_TRIP_SLACK_SEC = 1e-6;

/**
 * Id of the shot under the playhead. Re-renders only when that id
 * changes, not on every tick.
 */
export function useActiveShotId(partition: ShotPartition): string | null {
  const store = useEditorStore();
  const subscribe = useCallback((onChange: () => void) => {
    store.addEventListener('timechange', onChange);
    return () => store.removeEventListener('timechange', onChange);
  }, [store]);
  const getSnapshot = useCallback(
    () => partition.at(store.snapshot().video.currentTime + ROUND_TRIP_SLACK_SEC)?.id ?? null,
    [partition, store],
  );
  return useSyncExternalStore(subscribe, getSnapshot);
}

import { useCallback, useSyncExternalStore } from 'react';
import type { FootageSoundStatus } from '@core/audio-mix/services/FootageSoundAvailability';
import { useAudioMix } from '@ui/_shared/contexts/modules/AudioMixContext';

/** Whether each of the videos `mediaIds` names has a sound to hear, in their order, re-rendering as each is found out. */
export function useFootageSoundStatuses(mediaIds: readonly string[]): readonly FootageSoundStatus[] {
  const availability = useAudioMix().services.footageSounds;
  const subscribe = useCallback((listener: () => void) => {
    availability.addEventListener('change', listener);
    return () => availability.removeEventListener('change', listener);
  }, [availability]);
  // A joined string is stable across renders while nothing changes, as the store asks of a snapshot.
  const joined = useSyncExternalStore(subscribe, () => mediaIds.map((mediaId) => availability.statusOf(mediaId)).join(','));
  return joined === '' ? [] : joined.split(',') as FootageSoundStatus[];
}

import { useCallback, useSyncExternalStore } from 'react';
import type { Keymap } from '@core/shortcuts/domain/Keymap';
import { useShortcuts } from '@ui/_shared/contexts/modules/ShortcutsContext';

/** The keymap in force, re-read whenever the user changes it. */
export function useKeymap(): Keymap {
  const { store } = useShortcuts();
  const subscribe = useCallback((notify: () => void) => {
    store.addEventListener('change', notify);
    return () => store.removeEventListener('change', notify);
  }, [store]);
  return useSyncExternalStore(subscribe, () => store.keymap);
}

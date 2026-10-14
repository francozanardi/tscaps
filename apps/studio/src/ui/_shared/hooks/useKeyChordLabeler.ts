import { useMemo } from 'react';
import { KeyChordLabeler } from '@presentation/shortcuts/services/KeyChordLabeler';
import { useUtils } from '@ui/_shared/contexts/modules/UtilsContext';

/** Names chords the way this device's keyboard prints them. */
export function useKeyChordLabeler(): KeyChordLabeler {
  const { userAgentInspector } = useUtils();
  return useMemo(() => {
    const os = userAgentInspector.getOs();
    return new KeyChordLabeler(os === 'macos' || os === 'ios');
  }, [userAgentInspector]);
}

import { useCallback, useSyncExternalStore } from 'react';
import { MOBILE_VIEWPORT_QUERY } from '@ui/_shared/hooks/useIsMobileViewport';

// A phone's layout, or a screen with no pointer that hovers (a tablet): either way the tools over the frame,
// which show on hover, cannot be found there.
const BY_TOUCH_QUERY = `${MOBILE_VIEWPORT_QUERY}, (hover: none)`;

/**
 * Whether marking starts from outside the frame: on a phone's layout or
 * a screen without hover, the tools over the frame stay hidden until
 * something outside it picks one. Follows the window as it changes.
 */
export function useReviewMarkingByTouch(): boolean {
  const subscribe = useCallback((notify: () => void) => {
    const query = window.matchMedia(BY_TOUCH_QUERY);
    query.addEventListener('change', notify);
    return () => query.removeEventListener('change', notify);
  }, []);
  return useSyncExternalStore(subscribe, () => window.matchMedia(BY_TOUCH_QUERY).matches, () => false);
}

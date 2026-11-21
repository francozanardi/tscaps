import { useCallback, useSyncExternalStore } from 'react';

/**
 * Where the visible part of the page ends, in pixels from the top of the
 * window as `position: fixed` measures it: above an on-screen keyboard
 * while one is open. Follows the keyboard and the page's zoom.
 */
export function useVisualViewportBottom(): number {
  const subscribe = useCallback((notify: () => void) => {
    const viewport = window.visualViewport;
    window.addEventListener('resize', notify);
    viewport?.addEventListener('resize', notify);
    viewport?.addEventListener('scroll', notify);
    return () => {
      window.removeEventListener('resize', notify);
      viewport?.removeEventListener('resize', notify);
      viewport?.removeEventListener('scroll', notify);
    };
  }, []);
  return useSyncExternalStore(subscribe, () => {
    const viewport = window.visualViewport;
    return viewport === null ? window.innerHeight : viewport.offsetTop + viewport.height;
  }, () => 0);
}

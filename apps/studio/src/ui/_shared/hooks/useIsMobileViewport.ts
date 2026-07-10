import { useEffect, useState } from 'react';

/** Cutoff for mobile layout. Matches the Tailwind `lg` breakpoint used across
 *  the editor's responsive classes — keep them in sync. */
const MOBILE_VIEWPORT_QUERY = '(max-width: 1023px)';

/**
 * Reactive **viewport-width** check used to drive structural layout
 * decisions that can't be expressed in CSS alone (e.g. swapping
 * `PanelGroup` for a stacked column). Resizing a desktop window narrow
 * enough returns `true` even on a desktop machine; this is the right
 * signal for layout, not for device-class gating — see
 * `useIsMobileDevice` for that.
 *
 * For purely visual differences, prefer Tailwind `lg:` modifiers.
 */
export function useIsMobileViewport(): boolean {
  const [isMobile, setIsMobile] = useState(() =>
    typeof window === 'undefined' ? false : window.matchMedia(MOBILE_VIEWPORT_QUERY).matches,
  );
  useEffect(() => {
    const mql = window.matchMedia(MOBILE_VIEWPORT_QUERY);
    const update = () => setIsMobile(mql.matches);
    mql.addEventListener('change', update);
    return () => mql.removeEventListener('change', update);
  }, []);
  return isMobile;
}

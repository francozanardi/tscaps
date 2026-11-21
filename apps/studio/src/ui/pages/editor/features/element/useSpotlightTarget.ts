import { useEffect, useMemo, useRef, type RefObject } from 'react';
import { SpotlightFocus } from '@ui/pages/editor/features/element/SpotlightFocus';
import { useSpotlightRequest } from '@ui/pages/editor/features/element/SpotlightContext';

/**
 * Registers the element the returned ref lands on as the part of a
 * panel another place may point to under `key`: when the panel is opened
 * on it, it is scrolled to the middle of the view, kept there while the
 * page settles, and lit once it has come to rest.
 */
export function useSpotlightTarget<T extends HTMLElement>(key: string): RefObject<T> {
  const ref = useRef<T>(null);
  const { key: waiting, spotlit } = useSpotlightRequest();
  const focus = useMemo(() => new SpotlightFocus(), []);
  // Outlives the request, which is let go as soon as the showing starts; stopped only when the part goes.
  const stop = useRef<() => void>(() => {});
  useEffect(() => () => stop.current(), []);
  useEffect(() => {
    const element = ref.current;
    if (waiting !== key || element === null) return;
    stop.current();
    stop.current = focus.start(element);
    spotlit();
  }, [waiting, key, spotlit, focus]);
  return ref;
}

import { useEffect, useState, type RefObject } from 'react';

/**
 * Reactive pixel height of a referenced element, updated on every
 * layout change via `ResizeObserver`. Returns `0` while the ref is
 * empty or before the first observation delivers a measurement, so
 * callers must handle that transient with a sensible fallback.
 */
export function useObservedHeightPx(elementRef: RefObject<HTMLElement | null>): number {
  const [heightPx, setHeightPx] = useState(0);
  useEffect(() => {
    const el = elementRef.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      const measured = entries[0]?.contentRect.height ?? 0;
      setHeightPx(measured);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [elementRef]);
  return heightPx;
}

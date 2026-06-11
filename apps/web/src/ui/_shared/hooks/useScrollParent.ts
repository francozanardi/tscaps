import { useCallback, useState } from 'react';

/**
 * Resolves the nearest ancestor that actually scrolls vertically.
 * Returns a ref callback to attach to any element inside the target subtree,
 * and the scroll element once found. The element is tracked in state so
 * consumers that depend on it (e.g. virtualizers) re-attach when it appears.
 */
export function useScrollParent(): [(node: HTMLElement | null) => void, HTMLElement | null] {
  const [scrollEl, setScrollEl] = useState<HTMLElement | null>(null);

  const ref = useCallback((node: HTMLElement | null) => {
    if (!node) {
      setScrollEl(null);
      return;
    }
    let el: HTMLElement | null = node.parentElement;
    while (el) {
      const { overflowY } = getComputedStyle(el);
      if (overflowY === 'auto' || overflowY === 'scroll') {
        setScrollEl(el);
        return;
      }
      el = el.parentElement;
    }
    setScrollEl(null);
  }, []);

  return [ref, scrollEl];
}

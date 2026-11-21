import { useLayoutEffect, useState, type RefObject } from 'react';

/**
 * The box `ref`'s element takes on screen, measured again when it is
 * resized, when the window is, and when anything scrolls; null until it
 * is mounted.
 */
export function useElementRect(ref: RefObject<HTMLElement | null>): DOMRect | null {
  const [rect, setRect] = useState<DOMRect | null>(null);
  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return;
    const measure = () => {
      const next = element.getBoundingClientRect();
      setRect((held) => (held !== null && held.x === next.x && held.y === next.y && held.width === next.width && held.height === next.height ? held : next));
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    window.addEventListener('resize', measure);
    window.addEventListener('scroll', measure, true);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', measure);
      window.removeEventListener('scroll', measure, true);
    };
  }, [ref]);
  return rect;
}

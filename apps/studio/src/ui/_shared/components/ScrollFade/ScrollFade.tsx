import { useEffect, useState, type RefObject } from 'react';

interface ScrollFadeProps {
  /** Ref to the scrolling element (the one with `overflow-y: auto`). */
  scrollRef: RefObject<HTMLElement | null>;
  /**
   * Where the fade sits and the surface it fades into, for a scroller
   * that is not the editor sidebar card. Defaults to the card's.
   */
  placementClassName?: string;
}

const SIDEBAR_CARD_PLACEMENT = 'bottom-3 left-3 right-5 to-surface-1';

/**
 * Bottom-edge gradient that fades scroll content into the surrounding
 * surface, hiding itself when the watched scroll viewport is already at
 * the bottom.
 *
 * Render as a sibling of the scrolling element, inside a positioned
 * wrapper. Putting the fade *inside* the overflow-auto element itself
 * makes some browsers drag it along with the scroll content instead of
 * pinning it to the visible bottom.
 *
 * The default insets are tuned for the editor sidebar card (panel
 * padding + scrollbar gutter).
 */
export function ScrollFade({ scrollRef, placementClassName = SIDEBAR_CARD_PLACEMENT }: ScrollFadeProps) {
  const atBottom = useScrollAtBottom(scrollRef);
  return (
    <div
      aria-hidden="true"
      className={
        `pointer-events-none absolute h-8 bg-gradient-to-b from-transparent ${placementClassName} ` +
        'transition-opacity duration-quick ease-standard ' +
        (atBottom ? 'opacity-0' : 'opacity-100')
      }
    />
  );
}

function useScrollAtBottom(ref: RefObject<HTMLElement | null>): boolean {
  const [atBottom, setAtBottom] = useState(true);
  // setState mirrors a live DOM scroll signal (an external system).
  useEffect(() => {
    const el = ref.current;
    if (!el) {
      setAtBottom(true);
      return;
    }
    const update = () => {
      // 1px tolerance absorbs sub-pixel rounding at the boundary.
      const overflow = el.scrollHeight - el.clientHeight;
      setAtBottom(overflow <= 1 || el.scrollTop >= overflow - 1);
    };
    update();
    el.addEventListener('scroll', update, { passive: true });
    // Observe the first child too: container resize alone misses content
    // height changes (collapsible sections, dynamic segment lists).
    const ro = new ResizeObserver(update);
    ro.observe(el);
    if (el.firstElementChild) ro.observe(el.firstElementChild);
    return () => {
      el.removeEventListener('scroll', update);
      ro.disconnect();
    };
  }, [ref]);
  return atBottom;
}

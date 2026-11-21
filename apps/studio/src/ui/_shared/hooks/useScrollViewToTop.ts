import { useLayoutEffect, useRef, type RefObject } from 'react';

/**
 * The event, bubbling from inside a scroll view, that asks the view to
 * start again from its top. A view that keeps its own place (the
 * scroll slack spacer) answers it and calls `preventDefault`.
 */
export const SCROLL_VIEW_TO_TOP_EVENT = 'tscaps-scroll-view-to-top';

/**
 * Scrolls the view holding `ref` back to its top each time `page`
 * changes after the first render, before the change is painted: for
 * content that replaces what the view showed rather than changing it,
 * like a gallery opening one of its sections. A view with no scroll
 * slack spacer is found as the nearest scrolled ancestor.
 */
export function useScrollViewToTop(ref: RefObject<HTMLElement | null>, page: unknown): void {
  const shownPage = useRef(page);
  useLayoutEffect(() => {
    if (Object.is(shownPage.current, page)) return;
    shownPage.current = page;
    const element = ref.current;
    if (!element) return;
    const request = new Event(SCROLL_VIEW_TO_TOP_EVENT, { bubbles: true, cancelable: true });
    if (!element.dispatchEvent(request)) return;
    for (let view = element.parentElement; view; view = view.parentElement) {
      if (view.scrollTop > 0) {
        view.scrollTop = 0;
        return;
      }
    }
  }, [ref, page]);
}

import { useLayoutEffect, useRef } from 'react';
import { ScrollSlack, type ScrollSlackPlace } from '@presentation/editor/services/ScrollSlack';
import { SCROLL_VIEW_HOLD_EVENT } from '@ui/_shared/hooks/useScrollViewHold';
import { SCROLL_VIEW_TO_TOP_EVENT } from '@ui/_shared/hooks/useScrollViewToTop';

/**
 * Keeps the scroll view it is the last child of where it was when the
 * content above it shrinks: a choice that hides the fields depending on
 * it leaves everything above it, the choice included, where it was,
 * rather than sliding it all down to fill the view
 * ({@link ScrollSlack}). It is the room left empty for that, and is
 * none at all until the content shrinks under a view scrolled past
 * where it now ends.
 *
 * It watches the size of every element beside it and reads the view's
 * own; it adds nothing to the layout of what it sits beside.
 *
 * It holds the view only for a change a control asked it to hold for
 * (`useScrollViewHold`, which the shared field controls call), until the
 * second frame after the request: long enough for the change to render.
 * Any other change of the content, such as a page of the panel replacing
 * another, lets the view go where the browser puts it. Content that
 * replaces the page can also ask for the top (`useScrollViewToTop`), and
 * the place held so far is dropped.
 */
export function ScrollSlackSpacer() {
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const spacer = ref.current;
    const view = spacer?.parentElement;
    if (!spacer || !view) return undefined;
    const slack = new ScrollSlack();
    // Where the content ends is where the spacer starts, plus the view's own padding below it: read off the
    // spacer rather than the view's scroll height, which never drops below the view's own however short the
    // content is.
    const paddingBottom = parseFloat(getComputedStyle(view).paddingBottom) || 0;
    const contentHeight = () => spacer.getBoundingClientRect().top - view.getBoundingClientRect().top - view.clientTop
      + view.scrollTop + paddingBottom;
    let holdRequests = 0;
    const holdsPlace = () => holdRequests > 0;
    // A frame's resize reports run after its animation frame callbacks: the change rendered in the frame after the
    // request is still held, and the hold ends before the one after it.
    const onHold = () => {
      holdRequests += 1;
      requestAnimationFrame(() => requestAnimationFrame(() => { holdRequests -= 1; }));
    };
    const keep = (place: ScrollSlackPlace) => {
      spacer.style.height = `${place.slackPx}px`;
      if (view.scrollTop !== place.scrollTop) view.scrollTop = place.scrollTop;
    };
    slack.scrolled(view.scrollTop, contentHeight(), view.clientHeight, false);
    const onScroll = () => keep(slack.scrolled(view.scrollTop, contentHeight(), view.clientHeight, holdsPlace()));
    const onToTop = (event: Event) => {
      event.preventDefault();
      keep(slack.restart());
    };
    // Runs after layout and before paint: the view the browser pulled back is put back before it shows.
    const sizes = new ResizeObserver(() => keep(slack.resized(contentHeight(), view.clientHeight, holdsPlace(), view.scrollTop)));
    const watchSiblings = () => {
      sizes.disconnect();
      for (const child of Array.from(view.children)) if (child !== spacer) sizes.observe(child);
    };
    const children = new MutationObserver(watchSiblings);
    watchSiblings();
    children.observe(view, { childList: true });
    view.addEventListener('scroll', onScroll, { passive: true });
    view.addEventListener(SCROLL_VIEW_HOLD_EVENT, onHold);
    view.addEventListener(SCROLL_VIEW_TO_TOP_EVENT, onToTop);
    return () => {
      view.removeEventListener(SCROLL_VIEW_TO_TOP_EVENT, onToTop);
      sizes.disconnect();
      children.disconnect();
      view.removeEventListener('scroll', onScroll);
      view.removeEventListener(SCROLL_VIEW_HOLD_EVENT, onHold);
    };
  }, []);
  return <div ref={ref} aria-hidden className="shrink-0" />;
}

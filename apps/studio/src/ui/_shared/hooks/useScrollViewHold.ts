import { useCallback } from 'react';

/**
 * The event, bubbling from a control inside a scroll view, that says the
 * change the control is about to make should leave the view where it is,
 * even if the content shrinks under it. The scroll slack spacer answers
 * it; a view without one ignores it.
 */
export const SCROLL_VIEW_HOLD_EVENT = 'tscaps-scroll-view-hold';

/**
 * Returns `hold(control)`: call it with the control the person just used,
 * right before the change it makes, for a change that can hide what
 * depends on it (a choice hiding the fields below). The view holding the
 * control keeps its place for that change only: whatever the content does
 * in the next frames. Any change not asked for this way lets the view go
 * where the browser puts it.
 */
export function useScrollViewHold(): (control: Element) => void {
  return useCallback((control: Element) => {
    control.dispatchEvent(new Event(SCROLL_VIEW_HOLD_EVENT, { bubbles: true }));
  }, []);
}

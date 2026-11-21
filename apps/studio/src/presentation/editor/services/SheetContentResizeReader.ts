/**
 * Which way a drag starting on a point of the sheet's content may resize the sheet:
 * `'both'` where nothing under the point scrolls vertically, `'shrink'` where everything
 * that does is scrolled to its top (a pull down has nothing left to scroll), `'none'`
 * elsewhere, where the drag belongs to the content.
 */
export type SheetContentResize = 'both' | 'shrink' | 'none';

// A scroll position this close to the top counts as the top: positions can be fractional, and iOS bounces past it.
const TOP_TOLERANCE_PX = 1;

// Fields take a drag for themselves: it selects text or moves a slider's thumb.
const OWN_DRAG_SELECTOR = 'input, textarea, select, [contenteditable]:not([contenteditable="false"])';

/**
 * Reads, from the page as it is when a touch lands, whether a drag from that
 * point may resize the sheet, by looking at what lies between the point and
 * the sheet: the vertical scrollers, and anything that handles a drag itself.
 */
export class SheetContentResizeReader {
  /** What a drag starting on `target` may do to `sheet`; `target` outside `sheet` answers `'none'`. */
  resizeAt(target: Element, sheet: Element): SheetContentResize {
    if (!sheet.contains(target)) return 'none';
    let scrolls = false;
    for (let element: Element | null = target; element !== null && element !== sheet; element = element.parentElement) {
      if (this.takesOwnDrag(element)) return 'none';
      if (!this.scrollsVertically(element)) continue;
      if (element.scrollTop > TOP_TOLERANCE_PX) return 'none';
      scrolls = true;
    }
    return scrolls ? 'shrink' : 'both';
  }

  private takesOwnDrag(element: Element): boolean {
    if (element.matches(OWN_DRAG_SELECTOR)) return true;
    // A control that turned the browser's own panning off (a crop box, a range slider of ours) drags by itself.
    const touchAction = getComputedStyle(element).touchAction;
    return touchAction !== 'auto' && touchAction !== 'manipulation';
  }

  private scrollsVertically(element: Element): boolean {
    if (element.scrollHeight <= element.clientHeight + TOP_TOLERANCE_PX) return false;
    const overflowY = getComputedStyle(element).overflowY;
    return overflowY === 'auto' || overflowY === 'scroll';
  }
}

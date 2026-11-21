// Room kept between the part shown and the edges of what scrolls it.
const COMFORT_PX = 24;
// How long the page may still be growing (a picture loading) after it opens.
const SETTLE_MS = 900;
// How long a smooth scroll takes to come to rest before the part is lit.
const LIGHT_DELAY_MS = 450;
const LIT_CLASS = 'inspector-spotlight';

/**
 * Shows one part of a page: scrolls it to the middle of what scrolls it,
 * again for as long as the page goes on growing around it, and lights it
 * once it has come to rest, so the eye follows it there.
 */
export class SpotlightFocus {
  /** Starts showing `element`; the returned function stops whatever is still to come. */
  start(element: HTMLElement): () => void {
    const scroller = this.scrollerOf(element);
    const reveal = () => {
      if (!this.isComfortablyInView(element, scroller)) element.scrollIntoView({ block: 'center', behavior: 'smooth' });
    };
    const frame = requestAnimationFrame(reveal);
    const growth = new ResizeObserver(reveal);
    for (const child of scroller?.children ?? []) growth.observe(child);
    const stopWatching = window.setTimeout(() => growth.disconnect(), SETTLE_MS);
    const light = window.setTimeout(() => this.light(element), LIGHT_DELAY_MS);
    return () => {
      cancelAnimationFrame(frame);
      growth.disconnect();
      window.clearTimeout(stopWatching);
      window.clearTimeout(light);
    };
  }

  private light(element: HTMLElement): void {
    // Taken off and put back so a second visit plays the light again.
    element.classList.remove(LIT_CLASS);
    void element.offsetWidth;
    element.classList.add(LIT_CLASS);
    element.addEventListener('animationend', () => element.classList.remove(LIT_CLASS), { once: true });
  }

  private isComfortablyInView(element: HTMLElement, scroller: HTMLElement | null): boolean {
    const box = element.getBoundingClientRect();
    const view = scroller?.getBoundingClientRect() ?? { top: 0, bottom: window.innerHeight };
    return box.top >= view.top + COMFORT_PX && box.bottom <= view.bottom - COMFORT_PX;
  }

  private scrollerOf(element: HTMLElement): HTMLElement | null {
    for (let parent = element.parentElement; parent !== null; parent = parent.parentElement) {
      const { overflowY } = getComputedStyle(parent);
      if ((overflowY === 'auto' || overflowY === 'scroll') && parent.scrollHeight > parent.clientHeight) return parent;
    }
    return null;
  }
}

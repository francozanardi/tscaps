import { useLayoutEffect, useRef, type RefObject } from 'react';
import { useOverlayDragState } from '@ui/pages/editor/features/overlay/hooks/useOverlayDragState';
import { measureWordRotatedBox } from '@ui/pages/editor/features/overlay/wordRotatedBoxProbe';

interface WordSelectionRingProps {
  wordId: string;
  /** Positioned ancestor (the segment hitzone) the ring is measured against and mounted in. */
  containerRef: RefObject<HTMLElement>;
}

/**
 * Selection ring for the active word, drawn as an absolutely-positioned
 * box over the word but OUTSIDE the filtered `.segment`. A template's
 * segment-level SVG filter (outline/glow) flattens its whole subtree, so a
 * selection outline placed on the word itself gets captured and distorted
 * by the filter; drawing it as a sibling of the filtered segment keeps it
 * crisp.
 *
 * Re-measures on selection change and on container resize. It does not
 * track per-frame word animation, so the ring can lag for templates that
 * move words during playback (it stays put for templates whose words only
 * change colour, like the impact styles).
 */
export function WordSelectionRing({ wordId, containerRef }: WordSelectionRingProps) {
  const ringRef = useRef<HTMLDivElement>(null);
  const dragState = useOverlayDragState();

  useLayoutEffect(() => {
    const ring = ringRef.current;
    const container = containerRef.current;
    if (!ring || !container) return;
    // Widen the search to the whole scaler so a detached word — rendered as
    // a sibling of the segment hitzone, outside `container` — is still
    // found. There is at most one rendered span per word id.
    const scope = container.closest<HTMLElement>('.subtitle-overlay-scaler') ?? container;
    const reposition = () => repositionRing(ring, container, scope, wordId);
    reposition();
    const observer = new ResizeObserver(reposition);
    observer.observe(container);
    return () => observer.disconnect();
  }, [wordId, containerRef]);

  // Re-measure on every drag-state transition: during a word drag of
  // THIS word the offset written to its span moves the bbox; on
  // commit, the post-action layout may land a pixel off the last drag
  // tick (wrapper centering vs span centering), and without this
  // re-measure the ring would freeze at the stale spot.
  useLayoutEffect(() => {
    const ring = ringRef.current;
    const container = containerRef.current;
    if (!ring || !container) return;
    const scope = container.closest<HTMLElement>('.subtitle-overlay-scaler') ?? container;
    repositionRing(ring, container, scope, wordId);
  }, [dragState, wordId, containerRef]);

  if (dragState?.kind === 'segment-rotate') return null;
  return <div ref={ringRef} className="subtitle-overlay-word-selection" aria-hidden />;
}

// Inflates the ring box by this many px on each side so the stroke
// keeps a small gap from the word glyphs — the CSS stroke itself sits
// flush against the ring edges, so the gap has to come from the box.
const SELECTION_RING_PADDING_PX = 3;

function repositionRing(
  ring: HTMLDivElement,
  container: HTMLElement,
  scope: HTMLElement,
  wordId: string,
): void {
  const layout = measureWordRotatedBox(scope, wordId);
  if (!layout) {
    ring.style.visibility = 'hidden';
    return;
  }
  const box = container.getBoundingClientRect();
  const width = layout.unrotatedWidth + SELECTION_RING_PADDING_PX * 2;
  const height = layout.unrotatedHeight + SELECTION_RING_PADDING_PX * 2;
  ring.style.visibility = 'visible';
  ring.style.left = `${layout.visualCenterX - width / 2 - box.left}px`;
  ring.style.top = `${layout.visualCenterY - height / 2 - box.top}px`;
  ring.style.width = `${width}px`;
  ring.style.height = `${height}px`;
  ring.style.transform = layout.transform;
  ring.style.transformOrigin = 'center';
}

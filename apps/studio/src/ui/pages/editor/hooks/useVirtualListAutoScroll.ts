import { useEffect, useRef } from 'react';
import type { Virtualizer } from '@tanstack/react-virtual';
import type { ScrollRequest } from '@ui/pages/editor/hooks/useSegmentSearchControls';

interface VirtualListAutoScrollParams {
  virtualizer: Virtualizer<HTMLElement, Element>;
  scrollReady: boolean;
  /** The id of every item, in list order. */
  itemIds: ReadonlyArray<string>;
  /** The item under the playhead. */
  activeId: string | null;
  isPlaying: boolean;
  scrollRequest: ScrollRequest | null;
  /** While true, playback must not move the list under the user — picking from it, say. */
  holdStill: boolean;
  /**
   * Whether the list is on screen. A list kept mounted while hidden
   * spends its entry scroll where nobody sees it; this re-arms it for
   * every time the list is shown. Omitted means always on screen.
   */
  isVisible?: boolean;
}

/**
 * Wires a virtualized list of per-item cards to three scroll behaviors:
 *  - One-shot focus on the playhead-active item when the list is opened
 *    (works while paused — relies on `activeId` being derived from the
 *    current video time).
 *  - Follow-along during playback, scrolling the just-changed item to
 *    center. Manual edits while paused never yank the view, and neither
 *    does playback while `holdStill` is set.
 *  - On-demand scroll to a caller-specified item whenever the
 *    `scrollRequest` reference changes (used by the Locate button and
 *    search match navigation).
 *
 * `scrollReady` must flip to true once the virtualizer's scroll element
 * has been resolved by the consumer; otherwise scrolls fire before the
 * element is wired up and silently no-op.
 */
export function useVirtualListAutoScroll(params: VirtualListAutoScrollParams) {
  const { virtualizer, scrollReady, itemIds, activeId, isPlaying, scrollRequest, holdStill, isVisible = true } = params;

  // Auto-driven scrolls use `behavior: 'auto'` (instant) on purpose.
  // Smooth animations target an offset computed against the current
  // estimateSize-based predictions; as items mount along the way,
  // ResizeObserver re-measures asynchronously and the in-flight animation
  // doesn't recalibrate, leaving the destination off by tens-to-hundreds
  // of px and producing visible layout gaps. Instant jumps are corrected
  // by the virtualizer's next render once measurements settle.
  const didEntryScrollRef = useRef(false);
  useEffect(() => {
    if (!isVisible) {
      didEntryScrollRef.current = false;
      return;
    }
    if (!scrollReady) return;
    if (!activeId) return;
    if (didEntryScrollRef.current && !isPlaying) return;
    // The entry moment counts as spent either way, so letting go of the
    // list does not jump what the user just finished reading.
    didEntryScrollRef.current = true;
    if (holdStill) return;
    const idx = itemIds.indexOf(activeId);
    if (idx < 0) return;
    virtualizer.scrollToIndex(Math.max(0, idx - 1), { align: 'start', behavior: 'auto' });
  }, [isVisible, scrollReady, activeId, itemIds, isPlaying, holdStill, virtualizer]);

  const prevPositionsRef = useRef<Map<string, number>>(new Map());
  useEffect(() => {
    if (!scrollReady) return;
    const prev = prevPositionsRef.current;
    const next = new Map<string, number>();
    for (let i = 0; i < itemIds.length; i++) next.set(itemIds[i]!, i);
    // Always refresh the snapshot — skipping it would make the next eligible
    // tick compare against pre-edit positions and scroll to a stale "change".
    if (prev.size > 0 && isPlaying && !holdStill) {
      for (const [id, newIdx] of next) {
        const oldIdx = prev.get(id);
        if (oldIdx === undefined || oldIdx !== newIdx) {
          virtualizer.scrollToIndex(newIdx, { align: 'center', behavior: 'auto' });
          break;
        }
      }
    }
    prevPositionsRef.current = next;
  }, [scrollReady, itemIds, isPlaying, holdStill, virtualizer]);

  // Caller-driven scrolls. The parent bumps `scrollRequest` to a new
  // object reference whenever it wants the list to scroll to a specific
  // item (e.g. user clicked Locate or navigated to the next search
  // match). The token field disambiguates back-to-back requests to the
  // same segment so the effect re-fires every time.
  //
  // `itemIds` stays in the deps so the lookup sees the latest list, but it
  // also changes on every edit. Guard on the request identity
  // so only a fresh request scrolls — otherwise the last request stays
  // pinned and every edit re-scrolls to it.
  const lastHandledRequestRef = useRef<ScrollRequest | null>(null);
  useEffect(() => {
    if (!scrollReady || !scrollRequest) return;
    if (lastHandledRequestRef.current === scrollRequest) return;
    lastHandledRequestRef.current = scrollRequest;
    const idx = itemIds.indexOf(scrollRequest.targetId);
    if (idx < 0) return;
    const targetIdx = Math.max(0, idx - 1);
    // If the target is already in the rendered window, the virtualizer
    // knows the precise offset — a smooth scroll lands accurately. For
    // far jumps the offset depends on `estimateSize` for the items in
    // between, so the first jump is approximate and the destination can
    // end up off-screen. Smooth animations compound the problem by
    // mounting/unmounting items along the way faster than
    // ResizeObserver's async batches can fire, leaving destination items
    // stuck at the estimate (visible as dead space). The recovery is an
    // instant jump plus a follow-up scroll on the next frame, once the
    // destination has rendered and measurements have settled.
    const rendered = virtualizer.getVirtualItems();
    const targetRendered = rendered.some((vi) => vi.index === targetIdx);
    if (targetRendered) {
      virtualizer.scrollToIndex(targetIdx, { align: 'start', behavior: 'smooth' });
      return;
    }
    const rafs: number[] = [];
    const jump = () => virtualizer.scrollToIndex(targetIdx, { align: 'start', behavior: 'auto' });
    jump();
    rafs.push(requestAnimationFrame(() => {
      jump();
      rafs.push(requestAnimationFrame(jump));
    }));
    return () => rafs.forEach(cancelAnimationFrame);
  }, [scrollRequest, scrollReady, itemIds, virtualizer]);
}

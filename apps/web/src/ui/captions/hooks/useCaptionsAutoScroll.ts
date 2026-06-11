import { useEffect, useRef } from 'react';
import type { Virtualizer } from '@tanstack/react-virtual';
import type { SortedEntry } from "@ui/captions/components/CaptionsPanel";

export interface ScrollRequest {
  readonly segmentId: string;
  readonly token: number;
}

interface CaptionsAutoScrollParams {
  virtualizer: Virtualizer<HTMLElement, Element>;
  scrollReady: boolean;
  sorted: SortedEntry[];
  activeSegmentId: string | null;
  isPlaying: boolean;
  scrollRequest: ScrollRequest | null;
}

/**
 * Wires the captions virtualizer to three scroll behaviors:
 *  - One-shot focus on the playhead-active scene when the tab is opened
 *    (works while paused — relies on `activeSegmentId` being derived from
 *    the current video time).
 *  - Follow-along during playback, scrolling the just-changed scene to
 *    center. Manual edits while paused never yank the view.
 *  - On-demand scroll to a caller-specified segment whenever the
 *    `scrollRequest` reference changes (used by the Locate button and
 *    search match navigation).
 *
 * `scrollReady` must flip to true once the virtualizer's scroll element
 * has been resolved by the consumer; otherwise scrolls fire before the
 * element is wired up and silently no-op.
 */
export function useCaptionsAutoScroll(params: CaptionsAutoScrollParams) {
  const { virtualizer, scrollReady, sorted, activeSegmentId, isPlaying, scrollRequest } = params;

  // Auto-driven scrolls use `behavior: 'auto'` (instant) on purpose.
  // Smooth animations target an offset computed against the current
  // estimateSize-based predictions; as items mount along the way,
  // ResizeObserver re-measures asynchronously and the in-flight animation
  // doesn't recalibrate, leaving the destination off by tens-to-hundreds
  // of px and producing visible layout gaps. Instant jumps are corrected
  // by the virtualizer's next render once measurements settle.
  const didEntryScrollRef = useRef(false);
  useEffect(() => {
    if (!scrollReady) return;
    if (!activeSegmentId) return;
    if (didEntryScrollRef.current && !isPlaying) return;
    didEntryScrollRef.current = true;
    const idx = sorted.findIndex((e) => e.segment.id === activeSegmentId);
    if (idx < 0) return;
    virtualizer.scrollToIndex(Math.max(0, idx - 1), { align: 'start', behavior: 'auto' });
  }, [scrollReady, activeSegmentId, sorted, isPlaying, virtualizer]);

  const prevPositionsRef = useRef<Map<string, number>>(new Map());
  useEffect(() => {
    if (!scrollReady) return;
    const prev = prevPositionsRef.current;
    const next = new Map<string, number>();
    for (let i = 0; i < sorted.length; i++) next.set(sorted[i]!.segment.id, i);
    // Always refresh the snapshot — skipping it would make the next eligible
    // tick compare against pre-edit positions and scroll to a stale "change".
    if (prev.size > 0 && isPlaying) {
      for (const [id, newIdx] of next) {
        const oldIdx = prev.get(id);
        if (oldIdx === undefined || oldIdx !== newIdx) {
          virtualizer.scrollToIndex(newIdx, { align: 'center', behavior: 'auto' });
          break;
        }
      }
    }
    prevPositionsRef.current = next;
  }, [scrollReady, sorted, isPlaying, virtualizer]);

  // Caller-driven scrolls. The parent bumps `scrollRequest` to a new
  // object reference whenever it wants the list to scroll to a specific
  // segment (e.g. user clicked Locate or navigated to the next search
  // match). The token field disambiguates back-to-back requests to the
  // same segment so the effect re-fires every time.
  useEffect(() => {
    if (!scrollReady || !scrollRequest) return;
    const idx = sorted.findIndex((e) => e.segment.id === scrollRequest.segmentId);
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
  }, [scrollRequest, scrollReady, sorted, virtualizer]);
}

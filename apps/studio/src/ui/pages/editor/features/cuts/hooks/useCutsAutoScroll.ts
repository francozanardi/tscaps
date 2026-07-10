import { useEffect, useRef } from 'react';
import type { Virtualizer } from '@tanstack/react-virtual';
import type { CutsRow } from '@presentation/cuts/services/CutsTimelineProjection';
import type { ScrollRequest } from '@ui/pages/editor/hooks/useSegmentSearchControls';

interface CutsAutoScrollParams {
  virtualizer: Virtualizer<HTMLElement, Element>;
  scrollReady: boolean;
  rows: ReadonlyArray<CutsRow>;
  activeSegmentId: string | null;
  isPlaying: boolean;
  isActive: boolean;
  scrollRequest: ScrollRequest | null;
}

/**
 * Drives the Cuts mode virtualizer with three scroll behaviors:
 *  - One-shot focus on the playhead-active segment when the user
 *    enters Cuts mode (resets the next time they leave and re-enter).
 *  - Follow-along during playback, scrolling the just-activated
 *    segment to the panel's centre. Manual edits while paused don't
 *    yank the view.
 *  - On-demand scroll to a caller-specified segment whenever the
 *    `scrollRequest` reference changes (used by Locate and search
 *    match navigation).
 *
 * `scrollReady` must flip to true once the virtualizer's scroll
 * element has been resolved by the consumer; otherwise scrolls fire
 * before the element is wired up and silently no-op.
 */
export function useCutsAutoScroll(params: CutsAutoScrollParams) {
  const { virtualizer, scrollReady, rows, activeSegmentId, isPlaying, isActive, scrollRequest } = params;

  // Auto-driven scrolls use `behavior: 'auto'` (instant) on purpose.
  // Smooth animations target an offset computed against the current
  // estimateSize-based predictions; as items mount along the way,
  // ResizeObserver re-measures asynchronously and the in-flight
  // animation doesn't recalibrate, leaving the destination off by
  // tens-to-hundreds of px. Instant jumps are corrected by the
  // virtualizer's next render once measurements settle.
  const didEntryScrollRef = useRef(false);
  useEffect(() => {
    if (!isActive) {
      didEntryScrollRef.current = false;
      return;
    }
    if (!scrollReady) return;
    if (didEntryScrollRef.current) return;
    if (!activeSegmentId) return;
    const idx = rows.findIndex((row) => row.segmentId === activeSegmentId);
    if (idx < 0) return;
    didEntryScrollRef.current = true;
    virtualizer.scrollToIndex(idx, { align: 'start', behavior: 'auto' });
  }, [isActive, scrollReady, activeSegmentId, rows, virtualizer]);

  const prevActiveIdRef = useRef<string | null>(null);
  useEffect(() => {
    if (!isActive || !scrollReady || !isPlaying) {
      prevActiveIdRef.current = activeSegmentId;
      return;
    }
    if (activeSegmentId === prevActiveIdRef.current) return;
    prevActiveIdRef.current = activeSegmentId;
    if (!activeSegmentId) return;
    const idx = rows.findIndex((row) => row.segmentId === activeSegmentId);
    if (idx < 0) return;
    virtualizer.scrollToIndex(idx, { align: 'center', behavior: 'auto' });
  }, [isActive, scrollReady, isPlaying, activeSegmentId, rows, virtualizer]);

  // Caller-driven scrolls. Locate and search match navigation publish
  // a new `scrollRequest` reference (the token disambiguates back-to-
  // back requests to the same segment so the effect re-fires).
  //
  // `rows` stays in the deps so findIndex sees the latest list, but it
  // also changes on every cuts edit. Guard on the request identity so
  // only a fresh request scrolls — otherwise the last request stays
  // pinned and every edit re-scrolls to it.
  const lastHandledRequestRef = useRef<ScrollRequest | null>(null);
  useEffect(() => {
    if (!scrollReady || !scrollRequest) return;
    if (lastHandledRequestRef.current === scrollRequest) return;
    lastHandledRequestRef.current = scrollRequest;
    const idx = rows.findIndex((row) => row.segmentId === scrollRequest.segmentId);
    if (idx < 0) return;
    // If the target is already in the rendered window, the virtualizer
    // knows its precise offset and a single scroll lands correctly.
    // For far jumps the offset depends on `estimateSize` for the items
    // in between, so the first jump is approximate; re-issuing on the
    // next frame (once the destination has rendered and measurements
    // have settled) corrects the landing.
    const rendered = virtualizer.getVirtualItems();
    const targetRendered = rendered.some((vi) => vi.index === idx);
    if (targetRendered) {
      virtualizer.scrollToIndex(idx, { align: 'center', behavior: 'auto' });
      return;
    }
    const rafs: number[] = [];
    const jump = () => virtualizer.scrollToIndex(idx, { align: 'center', behavior: 'auto' });
    jump();
    rafs.push(requestAnimationFrame(() => {
      jump();
      rafs.push(requestAnimationFrame(jump));
    }));
    return () => rafs.forEach(cancelAnimationFrame);
  }, [scrollRequest, scrollReady, rows, virtualizer]);
}

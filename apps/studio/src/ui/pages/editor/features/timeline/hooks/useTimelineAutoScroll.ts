import { useEffect, useRef } from 'react';
import type { Virtualizer } from '@tanstack/react-virtual';
import { TimelineFollowScroll } from '@presentation/timeline/services/TimelineFollowScroll';
import {
  TimelineRowIndexResolver,
  type TimelineRowBounds,
} from '@presentation/timeline/services/TimelineRowIndexResolver';
import type { TimelineRowStack } from '@presentation/timeline/services/TimelineRowStack';
import { useEditorStore } from '@ui/_shared/contexts/EditorStoreContext';
import type { ScrollRequest } from '@ui/pages/editor/hooks/useSegmentSearchControls';

const followScroll = new TimelineFollowScroll();
const rowIndexResolver = new TimelineRowIndexResolver();

interface TimelineAutoScrollParams {
  virtualizer: Virtualizer<HTMLElement, Element>;
  scrollReady: boolean;
  /** Every row, in order, so the playhead can be placed in one. */
  rows: ReadonlyArray<TimelineRowBounds>;
  /**
   * Where the rows sit inside the scrolling element, or null while that
   * cannot be measured yet — nothing is placed until it is known.
   */
  rowStack: TimelineRowStack | null;
  /** Row holding a scene's start, or -1 when the scene is unknown. */
  rowIndexOfScene: (segmentId: string) => number;
  isPlaying: boolean;
  isActive: boolean;
  suppressed: boolean;
  scrollRequest: ScrollRequest | null;
}

/**
 * Drives the Timeline mode virtualizer with three scroll behaviors:
 *  - One-shot focus on the row holding the playhead when the user enters
 *    Timeline mode (resets the next time they leave and re-enter).
 *  - Follow-along during playback, keeping the row the playhead is in on
 *    screen. Manual edits while paused don't yank the view.
 *  - On-demand scroll to a caller-specified segment whenever the
 *    `scrollRequest` reference changes (used by Locate and search
 *    match navigation).
 *
 * Both of the first two follow the **playhead**, never the scene it is
 * inside. A scene can run for many rows, and the further the two are
 * allowed to drift the more the panel shows a place the video left long
 * ago — badly enough, zoomed in, for the playhead to be off screen
 * entirely.
 *
 * `scrollReady` must flip to true once the virtualizer's scroll
 * element has been resolved by the consumer; otherwise scrolls fire
 * before the element is wired up and silently no-op.
 *
 * `suppressed` holds every scroll that isn't the user's own doing.
 * Moving the content under a pointer that is mid-gesture shifts the
 * mapping from screen position to time, so the range would jump on its
 * own; a deferred scroll request runs once the gesture ends.
 */
export function useTimelineAutoScroll(params: TimelineAutoScrollParams) {
  const { virtualizer, scrollReady, rows, rowStack, rowIndexOfScene, isPlaying, isActive, suppressed, scrollRequest } = params;
  const store = useEditorStore();

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
    if (!scrollReady || didEntryScrollRef.current) return;
    if (rowStack === null || rows.length === 0) return;
    didEntryScrollRef.current = true;
    const rowIndex = rowIndexResolver.opening(store.snapshot().video.currentTime, rows);
    // Opening at the top rather than at the resting place, so the reader
    // arrives looking at where they are with what follows drawn under
    // it. Playback then fills downwards until the row settles by itself.
    virtualizer.scrollToOffset(rowStack.topPxOf(rowIndex), { align: 'start', behavior: 'auto' });
  }, [isActive, scrollReady, rows, rowStack, store, virtualizer]);

  // Asked on every frame of playback and answered from numbers alone.
  // Nothing here touches the DOM: the playhead cursor writes to it on
  // this same tick, and a layout read after those writes would force the
  // browser to settle the page sixty times a second. The virtualizer's
  // offset and size are fields it keeps from its own scroll and resize
  // observers, and the store hands back its state rather than building
  // it. The list is only moved when the answer is not null, so a still
  // panel stays still.
  useEffect(() => {
    if (!isActive || !scrollReady || !isPlaying || suppressed) return;
    if (rowStack === null || rows.length === 0) return;
    const follow = () => {
      const rowIndex = rowIndexResolver.opening(store.snapshot().video.currentTime, rows);
      const offsetPx = followScroll.offsetFor(
        rowStack.topPxOf(rowIndex),
        rowStack.heightPx,
        { offsetPx: virtualizer.scrollOffset ?? 0, heightPx: virtualizer.scrollRect?.height ?? 0 },
      );
      if (offsetPx === null) return;
      virtualizer.scrollToOffset(offsetPx, { align: 'start', behavior: 'auto' });
    };
    follow();
    store.addEventListener('timechange', follow);
    return () => store.removeEventListener('timechange', follow);
  }, [isActive, scrollReady, isPlaying, suppressed, rows, rowStack, store, virtualizer]);

  // Caller-driven scrolls. Locate and search match navigation publish
  // a new `scrollRequest` reference (the token disambiguates back-to-
  // back requests to the same segment so the effect re-fires).
  //
  // The lookup stays in the deps so it sees the latest timeline, but it
  // also changes on every cuts edit. Guard on the request identity so
  // only a fresh request scrolls — otherwise the last request stays
  // pinned and every edit re-scrolls to it.
  const lastHandledRequestRef = useRef<ScrollRequest | null>(null);
  useEffect(() => {
    if (!scrollReady || !scrollRequest || suppressed) return;
    if (lastHandledRequestRef.current === scrollRequest) return;
    lastHandledRequestRef.current = scrollRequest;
    const idx = rowIndexOfScene(scrollRequest.targetId);
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
  }, [scrollRequest, scrollReady, suppressed, rowIndexOfScene, virtualizer]);
}

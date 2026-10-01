import { memo, useCallback, useEffect, useMemo, useRef } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import type { CutRange } from '@core/cuts/domain/CutRegistry';
import type { TimelineView } from '@core/timeline/domain/TimelineView';
import type { TimelineSelection } from '@presentation/timeline/controllers/TimelineEditingController';
import type {
  TimelineRow,
  TimelineModel,
} from '@presentation/timeline/services/TimelineProjection';
import { TimelineRowIndexResolver } from '@presentation/timeline/services/TimelineRowIndexResolver';
import { TimelineRowGeometryResolver } from '@presentation/timeline/services/TimelineRowGeometryResolver';
import type { TimelineWaveformData } from '@presentation/timeline/controllers/TimelineWaveformController';
import { useScrollParent } from '@ui/_shared/hooks/useScrollParent';
import { useOffsetWithinScroller } from '@ui/_shared/hooks/useOffsetWithinScroller';
import { TimelineRowStack } from '@presentation/timeline/services/TimelineRowStack';
import type { ScrollRequest } from '@ui/pages/editor/hooks/useSegmentSearchControls';
import type { TimelineRowGeometry } from '@presentation/timeline/services/TimelineRowGeometryResolver';
import { Row } from '@ui/pages/editor/features/timeline/components/Row';
import { SelectionToolbar } from '@ui/pages/editor/features/timeline/components/SelectionToolbar';
import { useTimelineEditingController } from '@ui/pages/editor/features/timeline/contexts/TimelineEditingContext';
import { useTimelinePointerDragController } from '@ui/pages/editor/features/timeline/contexts/TimelinePointerDragContext';
import { useTimelineAutoScroll } from '@ui/pages/editor/features/timeline/hooks/useTimelineAutoScroll';
import { useTimelineScrollAnchor } from '@ui/pages/editor/features/timeline/hooks/useTimelineScrollAnchor';
import {
  useTimelineGestureActive,
  useTimelineSelection,
} from '@ui/pages/editor/features/timeline/hooks/useTimelineEditing';

const OVERSCAN_ROWS = 4;

const rowIndexResolver = new TimelineRowIndexResolver();
const geometryResolver = new TimelineRowGeometryResolver();

const LIST_OUTER_CLASS = 'flex flex-col';

interface TimelineProps {
  timeline: TimelineModel;
  view: TimelineView;
  cuts: ReadonlyArray<CutRange>;
  waveform: TimelineWaveformData | null;
  /** The strip is asked for and its audio is still being read. */
  waveformLoading: boolean;
  isPlaying: boolean;
  isActive: boolean;
  scrollRequest: ScrollRequest | null;
  highlightedSegmentId: string | null;
  onAddCut: (range: CutRange) => void;
  onRestoreRange: (range: CutRange) => void;
}

/**
 * Virtualized stack of the timeline's rows. Only the rows intersecting
 * the visible scroll window are mounted, plus a small overscan above
 * and below, so a long video doesn't blow up the DOM nor stack hundreds
 * of playhead listeners.
 *
 * Row heights are known before anything renders — every row of a given
 * timeline is the same height — so the virtualizer is given exact sizes
 * rather than estimates.
 *
 * Auto-scroll on mode entry, during playback and on caller-driven
 * requests is wired here because the virtualizer is the only entity
 * that knows the per-row offsets.
 */
export const Timeline = memo(function Timeline({
  timeline,
  view,
  cuts,
  waveform,
  waveformLoading,
  isPlaying,
  isActive,
  scrollRequest,
  highlightedSegmentId,
  onAddCut,
  onRestoreRange,
}: TimelineProps) {
  const [parentRef, scrollEl] = useScrollParent();
  // The scroll parent is resolved from a callback ref, which hands the
  // element over without keeping it; measuring where the list sits
  // inside that parent needs the element itself.
  const listElementRef = useRef<HTMLDivElement | null>(null);
  const attachList = useCallback((node: HTMLDivElement | null) => {
    listElementRef.current = node;
    parentRef(node);
  }, [parentRef]);
  const listTopPx = useOffsetWithinScroller(listElementRef, scrollEl);
  const dragController = useTimelinePointerDragController();
  const editingController = useTimelineEditingController();
  const { rows, scenes, dragTargets, sceneDragTargets, snapLandmarks } = timeline;
  // A strip being read takes its room already, so the rows grow once —
  // when it is asked for — and not again when the bars arrive.
  const hasWaveform = waveform !== null || waveformLoading;

  // Resolved once per row and handed to both the virtualizer and the
  // row itself, so the height reserved for a row and the numbers it is
  // drawn with are the same object rather than two matching sums.
  const geometry = useMemo(() => geometryResolver.resolve(hasWaveform), [hasWaveform]);

  // Null until the list has been found inside its scroller: a row cannot
  // be put anywhere on purpose before then.
  const rowStack = useMemo(
    () => (listTopPx === null ? null : new TimelineRowStack(listTopPx, geometry.totalHeightPx)),
    [listTopPx, geometry.totalHeightPx],
  );

  // The waveform strip is the one thing that changes a row's height, and
  // it changes every row's at once. The virtualizer caches measurements
  // on the item-size cache and `getItemKey` and never watches
  // `estimateSize`, so a height that moved without the key moving would
  // leave every row stacked on the one above it.
  const rowKey = useCallback(
    (index: number) => {
      const row = rows[index];
      return row ? `${row.index}:${hasWaveform}` : index;
    },
    [rows, hasWaveform],
  );

  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scrollEl,
    getItemKey: rowKey,
    estimateSize: () => geometry.totalHeightPx,
    overscan: OVERSCAN_ROWS,
  });

  useTimelineScrollAnchor({
    virtualizer,
    rowDurationSec: timeline.rowDurationSec,
    rowHeightPx: geometry.totalHeightPx,
  });

  const isGestureActive = useTimelineGestureActive();

  // Every surface that addresses a scene — locate, search navigation,
  // following the playhead — has to land on a row, and a scene starts
  // wherever its first word does rather than on a row boundary.
  const rowIndexOfScene = useCallback((segmentId: string) => {
    const scene = scenes.find((placement) => placement.segmentId === segmentId);
    if (!scene) return -1;
    return rowIndexResolver.opening(scene.startSec, rows);
  }, [scenes, rows]);

  useTimelineAutoScroll({
    virtualizer,
    scrollReady: !!scrollEl,
    rows,
    rowStack,
    rowIndexOfScene,
    isPlaying,
    isActive,
    suppressed: isGestureActive,
    scrollRequest,
  });

  // The pointer is captured on the scroll container rather than on a
  // row: rows are recycled as the list scrolls, and a capture on one
  // dies with it mid-gesture.
  useEffect(() => {
    dragController.setScrollElement(scrollEl);
    return () => dragController.setScrollElement(null);
  }, [dragController, scrollEl]);

  useEffect(() => {
    dragController.setSnapLandmarks(snapLandmarks[view]);
  }, [dragController, snapLandmarks, view]);

  const selection = useTimelineSelection();
  // Multiplied out rather than read back from the DOM, so the anchor of
  // a row that scrolled out of the mounted window — exactly the case the
  // toolbar has to survive — is still known.
  const toolbarAnchor = useMemo(
    () => anchorFor(selection, rows, geometry),
    [selection, rows, geometry],
  );
  // The selection is what the cut was aimed at, so it goes once the cut
  // is made: leaving it up would offer to cut a stretch that is already
  // gone.
  const cutSelection = () => {
    if (!selection) return;
    onAddCut({ startSec: selection.startSec, endSec: selection.endSec });
    editingController.clearSelection();
  };

  const items = virtualizer.getVirtualItems();

  return (
    <div ref={attachList} className={LIST_OUTER_CLASS}>
      <div style={{ height: virtualizer.getTotalSize(), position: 'relative', width: '100%' }}>
        {items.map((vi) => (
          <div
            key={vi.key}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              transform: `translateY(${vi.start}px)`,
            }}
          >
            <Row
              row={rows[vi.index]!}
              view={view}
              geometry={geometry}
              cuts={cuts}
              waveform={waveform}
              waveformLoading={waveformLoading}
              dragTargets={dragTargets}
              sceneDragTargets={sceneDragTargets}
              onCutScene={(startSec, endSec) => onAddCut({ startSec, endSec })}
              highlightedSegmentId={highlightedSegmentId}
              onRestoreRange={onRestoreRange}
            />
          </div>
        ))}
        {selection && toolbarAnchor && !isGestureActive && (
          <SelectionToolbar
            selection={selection}
            anchorTopPx={toolbarAnchor.topPx}
            anchorBottomPx={toolbarAnchor.bottomPx}
            focusFraction={toolbarAnchor.focusFraction}
            scrollElement={scrollEl}
            onCut={cutSelection}
            onCancel={() => editingController.clearSelection()}
          />
        )}
      </div>
    </div>
  );
});

/** Where the toolbar should sit, or null when there is nothing to anchor to. */
function anchorFor(
  selection: TimelineSelection | null,
  rows: ReadonlyArray<TimelineRow>,
  geometry: TimelineRowGeometry,
): { topPx: number; bottomPx: number; focusFraction: number } | null {
  if (!selection || rows.length === 0) return null;
  const index = selection.focusEdge === 'end'
    ? rowIndexResolver.closing(selection.endSec, rows)
    : rowIndexResolver.opening(selection.startSec, rows);
  const row = rows[index];
  if (!row) return null;
  const topPx = index * geometry.totalHeightPx;
  const focusSec = selection.focusEdge === 'end' ? selection.endSec : selection.startSec;
  const rowDurationSec = row.endSec - row.startSec;
  return {
    topPx,
    bottomPx: topPx + geometry.totalHeightPx,
    focusFraction: rowDurationSec > 0
      ? Math.max(0, Math.min(1, (focusSec - row.startSec) / rowDurationSec))
      : 0,
  };
}

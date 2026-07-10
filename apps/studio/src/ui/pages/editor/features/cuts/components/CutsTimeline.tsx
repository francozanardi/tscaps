import { memo } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import type { CutRange } from '@core/cuts/domain/CutRegistry';
import type { CutsRow } from '@presentation/cuts/services/CutsTimelineProjection';
import type { CutsWaveformData } from '@presentation/cuts/controllers/CutsWaveformController';
import { useScrollParent } from '@ui/_shared/hooks/useScrollParent';
import type { ScrollRequest } from '@ui/pages/editor/hooks/useSegmentSearchControls';
import { SegmentTimelineRow } from '@ui/pages/editor/features/cuts/components/SegmentTimelineRow';
import { useCutsAutoScroll } from '@ui/pages/editor/features/cuts/hooks/useCutsAutoScroll';

const ROW_HEIGHT_ESTIMATE_PX = 130;
const OVERSCAN_ROWS = 4;

const LIST_OUTER_CLASS = 'flex flex-col p-3';
const ITEM_WRAPPER_CLASS = 'pb-2';
const HIGHLIGHT_WRAPPER_CLASS = 'rounded-md ring-2 ring-accent ring-offset-2 ring-offset-surface-1';

interface CutsTimelineProps {
  rows: ReadonlyArray<CutsRow>;
  cuts: ReadonlyArray<CutRange>;
  waveform: CutsWaveformData | null;
  activeSegmentId: string | null;
  isPlaying: boolean;
  isActive: boolean;
  scrollRequest: ScrollRequest | null;
  highlightedSegmentId: string | null;
  onSeek: (timeSec: number) => void;
  onAddCut: (range: CutRange) => void;
  onRestoreRange: (range: CutRange) => void;
  onResizeCut: (originalRange: CutRange, newRange: CutRange) => void;
}

/**
 * Virtualized stack of one row per segment. Only the rows that
 * intersect the visible scroll window are mounted, plus a small
 * overscan above and below, so very long videos don't blow up the
 * DOM nor stack hundreds of playhead listeners. Auto-scroll on
 * mode-entry, during playback, and on caller-driven `scrollRequest`s
 * is wired here because the virtualizer is the only entity that
 * knows the per-row offsets. A ring decorates the row that matches
 * the panel's current search hit.
 */
export const CutsTimeline = memo(function CutsTimeline({
  rows,
  cuts,
  waveform,
  activeSegmentId,
  isPlaying,
  isActive,
  scrollRequest,
  highlightedSegmentId,
  onSeek,
  onAddCut,
  onRestoreRange,
  onResizeCut,
}: CutsTimelineProps) {
  const [parentRef, scrollEl] = useScrollParent();
  // eslint-disable-next-line react-hooks/incompatible-library -- @tanstack/react-virtual is not analyzable by the React Compiler.
  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scrollEl,
    estimateSize: () => ROW_HEIGHT_ESTIMATE_PX,
    overscan: OVERSCAN_ROWS,
    // Tie measurements to segment identity, not to position. Without
    // this, an insertion/removal that shifts subsequent indices keeps
    // cached heights glued to the old indices — producing overlapping
    // cards and missing rows.
    getItemKey: (index) => rows[index]!.segmentId,
  });

  useCutsAutoScroll({
    virtualizer,
    scrollReady: !!scrollEl,
    rows,
    activeSegmentId,
    isPlaying,
    isActive,
    scrollRequest,
  });

  const items = virtualizer.getVirtualItems();

  return (
    <div ref={parentRef} className={LIST_OUTER_CLASS}>
      <div style={{ height: virtualizer.getTotalSize(), position: 'relative', width: '100%' }}>
        {items.map((vi) => {
          const row = rows[vi.index]!;
          const isHighlighted = row.segmentId === highlightedSegmentId;
          return (
            <div
              key={row.segmentId}
              data-index={vi.index}
              ref={virtualizer.measureElement}
              className={ITEM_WRAPPER_CLASS}
              style={{ position: 'absolute', top: 0, left: 0, width: '100%', transform: `translateY(${vi.start}px)` }}
            >
              <div className={isHighlighted ? HIGHLIGHT_WRAPPER_CLASS : undefined}>
                <SegmentTimelineRow
                  row={row}
                  cuts={cuts}
                  waveform={waveform}
                  onSeek={onSeek}
                  onAddCut={onAddCut}
                  onRestoreRange={onRestoreRange}
                  onResizeCut={onResizeCut}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
});

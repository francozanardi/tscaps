import { memo, useMemo } from 'react';
import { flushSync } from 'react-dom';
import { useVirtualizer } from '@tanstack/react-virtual';
import type { Document, Segment } from '@tscaps/engine';
import type { Sheet } from '@core/sheets/domain/Sheet';
import type { SegmentStyleOverrides } from '@core/editor/domain/SegmentStyleOverrides';
import type { SegmentOverrides } from '@core/editor/domain/SegmentOverrides';
import type { SegmentTextareaFocuser } from '@presentation/editor/services/SegmentTextareaFocuser';
import { useScrollParent } from '@ui/_shared/hooks/useScrollParent';
import type { SortedEntry } from '@ui/captions/components/CaptionsPanel';
import { SceneCard } from '@ui/captions/components/SceneCard';
import { AddSceneButton } from '@ui/captions/components/AddSceneButton';
import { useCaptionsAutoScroll, type ScrollRequest } from '@ui/captions/hooks/useCaptionsAutoScroll';
import { useCaptionsCallbacks, type CaptionsCallbacks } from '@ui/captions/hooks/useCaptionsCallbacks';

interface FreeCaptionsViewProps {
  document: Document;
  sorted: SortedEntry[];
  activeSegmentId: string | null;
  isPlaying: boolean;
  scrollRequest: ScrollRequest | null;
  highlightedSegmentId: string | null;
  sheets: Sheet[];
  segmentOverrides: SegmentOverrides;
  videoDuration: number;
  textareaFocus: SegmentTextareaFocuser;
  onSeek: (time: number) => void;
  onApplyStructureEdit: (doc: Document) => void;
  onDeleteWords: (wordIds: string[]) => void;
  onAssignSegmentSheet: (segment: Segment, sheetId: string) => void;
  onCreateSheet: (name: string) => string | null;
  onSetSegmentStyleOverride: (segmentId: string, overrides: SegmentStyleOverrides) => void;
  onInsertSegment: (segIdx: number, position: 'before' | 'after') => string;
  onResetSegmentLayout: (segmentId: string) => void;
}

export const FreeCaptionsView = memo(function FreeCaptionsView({
  document,
  sorted,
  activeSegmentId,
  isPlaying,
  scrollRequest,
  highlightedSegmentId,
  sheets,
  segmentOverrides,
  videoDuration,
  textareaFocus,
  onSeek,
  onApplyStructureEdit,
  onDeleteWords,
  onAssignSegmentSheet,
  onCreateSheet,
  onSetSegmentStyleOverride,
  onInsertSegment,
  onResetSegmentLayout,
}: FreeCaptionsViewProps) {
  const captions = useCaptionsCallbacks();
  // Merge / split restore the caret to the destination textarea.
  // flushSync forces React to fully commit the action (including the
  // partner's seed-driven `setValue` in useLayoutEffect) before the
  // controller reads `ta.value`; otherwise it clamps the offset to the
  // stale pre-merge length.
  const wrappedCaptions = useMemo<CaptionsCallbacks>(() => ({
    ...captions,
    mergeWithSibling: (args) => {
      const restore = textareaFocus.planMergeFocus(document, args);
      flushSync(() => { captions.mergeWithSibling(args); });
      restore();
    },
    splitAtCursor: (args) => {
      flushSync(() => { captions.splitAtCursor(args); });
      textareaFocus.focusNextAfter(args.segmentId);
    },
  }), [captions, document, textareaFocus]);

  const flatByIdx = document.getSegments();
  const neighborByFlatIdx = (flatIdx: number) => {
    const prev = flatByIdx[flatIdx - 1];
    const next = flatByIdx[flatIdx + 1];
    return {
      prevEnd: prev ? prev.time.end : 0,
      nextStart: next ? next.time.start : (videoDuration > 0 ? videoDuration : flatByIdx[flatIdx]!.time.end),
    };
  };

  const [parentRef, scrollEl] = useScrollParent();
  // eslint-disable-next-line react-hooks/incompatible-library -- @tanstack/react-virtual is not analyzable by the React Compiler.
  const virtualizer = useVirtualizer({
    count: sorted.length,
    getScrollElement: () => scrollEl,
    estimateSize: () => 140,
    overscan: 4,
    // Tie measurements to segment identity, not to position. Without this,
    // inserting/removing a scene shifts every later item to a new index
    // while their cached heights stay glued to the old index — producing
    // overlapping cards, missing "+" buttons, and stray gaps.
    getItemKey: (index) => sorted[index]!.segment.id,
  });

  useCaptionsAutoScroll({ virtualizer, scrollReady: !!scrollEl, sorted, activeSegmentId, isPlaying, scrollRequest });

  const items = virtualizer.getVirtualItems();

  return (
    <div ref={parentRef} className="flex flex-col py-2 pl-1">
      <div style={{ height: virtualizer.getTotalSize(), position: 'relative', width: '100%' }}>
        {items.map((vi) => {
          const entry = sorted[vi.index]!;
          const { segment, flatIdx } = entry;
          const sheet = sheets.find((s) => s.id === segment.getSection().kind) ?? null;
          const isActive = activeSegmentId === segment.id;
          const isLastFlat = flatIdx === sorted.length - 1;
          const isFirstFlat = flatIdx === 0;
          const bounds = neighborByFlatIdx(flatIdx);
          const isFirstInList = vi.index === 0;
          const isLastInList = vi.index === sorted.length - 1;
          return (
            <div
              key={segment.id}
              data-index={vi.index}
              ref={virtualizer.measureElement}
              className="flex flex-col gap-1 pb-1"
              style={{ position: 'absolute', top: 0, left: 0, width: '100%', transform: `translateY(${vi.start}px)` }}
            >
              {isFirstInList && (
                <AddSceneButton
                  onClick={() => onInsertSegment(flatIdx, 'before')}
                  label="Add scene at start"
                />
              )}
              <div className={highlightedSegmentId === segment.id ? 'rounded-sm ring-2 ring-accent ring-offset-2 ring-offset-surface-1' : undefined}>
                <SceneCard
                  doc={document}
                  segment={segment}
                  segIdx={flatIdx}
                  isFirstSegment={isFirstFlat}
                  isLastSegment={isLastFlat}
                  isActive={isActive}
                  sheet={sheet}
                  sheets={sheets}
                  segmentOverrides={segmentOverrides}
                  captions={wrappedCaptions}
                  prevSegmentEnd={bounds.prevEnd}
                  nextSegmentStart={bounds.nextStart}
                  onSeek={onSeek}
                  onApplyStructureEdit={onApplyStructureEdit}
                  onDeleteWords={onDeleteWords}
                  onAssignSegmentSheet={onAssignSegmentSheet}
                  onCreateSheet={onCreateSheet}
                  onSetSegmentStyleOverride={onSetSegmentStyleOverride}
                  onResetSegmentLayout={onResetSegmentLayout}
                />
              </div>
              <AddSceneButton
                onClick={() => onInsertSegment(flatIdx, 'after')}
                label={isLastInList ? 'Add scene at end' : 'Add scene'}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
});

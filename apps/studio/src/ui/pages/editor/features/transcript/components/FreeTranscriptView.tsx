import { memo, useMemo } from 'react';
import { useCaptions } from '@ui/_shared/contexts/modules/CaptionsContext';
import { flushSync } from 'react-dom';
import { useVirtualizer } from '@tanstack/react-virtual';
import type { Document, Segment } from '@tscaps/engine';
import type { Sheet } from '@core/sheets/domain/Sheet';
import type { BehindActorSegmentOverrideRegistry } from '@core/person-segmentation/domain/BehindActorSegmentOverrideRegistry';
import type { FrozenSegmentSet } from '@core/captions/domain/FrozenSegmentSet';
import type { ElementStyles } from '@core/elements/domain/ElementStyles';
import type { DecorationOverrideRegistry } from '@core/captions/domain/DecorationOverrideRegistry';
import type { CutRegistry } from '@core/cuts/domain/CutRegistry';
import type { CutAwareDocumentBuilder } from '@core/cuts/services/CutAwareDocumentBuilder';
import type { SegmentTextareaFocuser } from '@presentation/editor/services/SegmentTextareaFocuser';
import { HOOK_SHEET_COLOR } from '@core/sheets/domain/Sheet';
import { useScrollParent } from '@ui/_shared/hooks/useScrollParent';
import type { SortedEntry } from '@ui/pages/editor/features/transcript/components/TranscriptPanel';
import { SceneCard } from '@ui/pages/editor/features/transcript/components/scenes/SceneCard';
import { AddSceneButton } from '@ui/pages/editor/features/transcript/components/scenes/AddSceneButton';
import { ScenePickOverlay } from '@ui/pages/editor/features/transcript/components/pick-mode/ScenePickOverlay';
import { useTranscriptAutoScroll } from '@ui/pages/editor/features/transcript/hooks/useTranscriptAutoScroll';
import type { ScrollRequest } from '@ui/pages/editor/hooks/useSegmentSearchControls';
import { useTranscriptCallbacks, type TranscriptCallbacks } from '@ui/pages/editor/features/transcript/hooks/useTranscriptCallbacks';
import { useScenePickController } from '@ui/pages/editor/features/transcript/contexts/ScenePickContext';
import { useScenePickSnapshot } from '@ui/pages/editor/features/transcript/hooks/useScenePickSnapshot';
import { useEffectivePickSelection } from '@ui/pages/editor/features/transcript/hooks/useEffectivePickSelection';
import { BulkSceneOverlay } from '@ui/pages/editor/features/transcript/components/bulk-mode/BulkSceneOverlay';

interface FreeTranscriptViewProps {
  document: Document;
  sorted: SortedEntry[];
  activeSegmentId: string | null;
  isPlaying: boolean;
  scrollRequest: ScrollRequest | null;
  highlightedSegmentId: string | null;
  sheets: Sheet[];
  elementStyles: ElementStyles;
  behindActorOverrides: BehindActorSegmentOverrideRegistry;
  frozenSegments: FrozenSegmentSet;
  decorationOverrides: DecorationOverrideRegistry;
  videoDuration: number;
  cuts: CutRegistry;
  cutAwareDocumentBuilder: CutAwareDocumentBuilder;
  textareaFocus: SegmentTextareaFocuser;
  onSeek: (time: number) => void;
  onApplyStructureEdit: (doc: Document) => void;
  onDeleteWords: (wordIds: string[]) => void;
  onAssignSegmentSheet: (segment: Segment, sheetId: string) => void;
  onCreateSheet: (name: string) => string | null;
  onInsertSegment: (anchorRef: string | number | null, position: 'before' | 'after') => string;
  onResetSegmentLayout: (segmentId: string) => void;
  bulkSelection?: ReadonlySet<string> | null;
  onToggleBulkScene?: (id: string, extendRange: boolean) => void;
}

export const FreeTranscriptView = memo(function FreeTranscriptView({
  document,
  sorted,
  activeSegmentId,
  isPlaying,
  scrollRequest,
  highlightedSegmentId,
  sheets,
  elementStyles,
  behindActorOverrides,
  frozenSegments,
  decorationOverrides,
  videoDuration,
  cuts,
  cutAwareDocumentBuilder,
  textareaFocus,
  onSeek,
  onApplyStructureEdit,
  onDeleteWords,
  onAssignSegmentSheet,
  onCreateSheet,
  onInsertSegment,
  onResetSegmentLayout,
  bulkSelection = null,
  onToggleBulkScene,
}: FreeTranscriptViewProps) {
  const captions = useTranscriptCallbacks();
  // Merge / split restore the caret to the destination textarea.
  // flushSync forces React to fully commit the action (including the
  // partner's seed-driven `setValue` in useLayoutEffect) before the
  // controller reads `ta.value`; otherwise it clamps the offset to the
  // stale pre-merge length.
  // The slider's stops, from the same rule the write is clamped to: the
  // hard time of the neighbours on this segment's own sheet, not the
  // padded window of whichever segment sits next in the flat document.
  const { segmentTimeBounds } = useCaptions().services;
  const visibleDocument = useMemo(
    () => cutAwareDocumentBuilder.build(document, cuts),
    [cutAwareDocumentBuilder, document, cuts],
  );
  const segmentLimits = useMemo(
    () => segmentTimeBounds.allLimits(visibleDocument, videoDuration),
    [segmentTimeBounds, visibleDocument, videoDuration],
  );
  const wrappedCaptions = useMemo<TranscriptCallbacks>(() => ({
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

  const scenePickController = useScenePickController();
  const pickSnapshot = useScenePickSnapshot();

  const orderedSceneIds = useMemo<ReadonlyArray<string>>(
    () => sorted.map((e) => e.segment.id),
    [sorted],
  );
  const pickSelection = useEffectivePickSelection(pickSnapshot, orderedSceneIds);

  const [parentRef, scrollEl] = useScrollParent();
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

  useTranscriptAutoScroll({
    virtualizer, scrollReady: !!scrollEl, sorted, activeSegmentId, isPlaying, scrollRequest,
    pickActive: pickSnapshot.isActive || bulkSelection !== null,
  });

  const items = virtualizer.getVirtualItems();

  if (sorted.length === 0) {
    return (
      <div className="flex flex-col gap-2 py-4 pl-1">
        <p className="text-sm text-fg-muted text-center m-0">No captions yet.</p>
        <AddSceneButton
          onClick={() => onInsertSegment(null, 'before')}
          label="Add first scene"
        />
      </div>
    );
  }

  return (
    <div ref={parentRef} className="flex flex-col py-2 pl-1">
      <div style={{ height: virtualizer.getTotalSize(), position: 'relative', width: '100%' }}>
        {items.map((vi) => {
          const entry = sorted[vi.index]!;
          const { segment, flatIdx, sectionKind } = entry;
          const sheet = sheets.find((s) => s.id === sectionKind) ?? null;
          const isActive = activeSegmentId === segment.id;
          const isLastFlat = flatIdx === sorted.length - 1;
          const isFirstFlat = flatIdx === 0;
          const bounds = neighborByFlatIdx(flatIdx);
          const limits = segmentLimits.get(segment.id);
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
              {bulkSelection === null && isFirstInList && (
                <AddSceneButton
                  onClick={() => onInsertSegment(segment.id, 'before')}
                  label="Add scene at start"
                />
              )}
              <div className={`relative ${highlightedSegmentId === segment.id ? 'rounded-sm ring-2 ring-accent ring-offset-2 ring-offset-surface-1' : ''}`}>
                <SceneCard
                  doc={document}
                  segment={segment}
                  segIdx={flatIdx}
                  isFirstSegment={isFirstFlat}
                  isLastSegment={isLastFlat}
                  isActive={isActive}
                  sheet={sheet}
                  sheets={sheets}
                  elementStyles={elementStyles}
                  behindActorOverrides={behindActorOverrides}
                  isFrozen={frozenSegments.has(segment.id)}
                  decorationOverrides={decorationOverrides}
                  cuts={cuts}
                  cutAwareDocumentBuilder={cutAwareDocumentBuilder}
                  captions={wrappedCaptions}
                  prevSegmentEnd={limits?.earliestStartSec ?? bounds.prevEnd}
                  nextSegmentStart={Number.isFinite(limits?.latestEndSec ?? Infinity)
                    ? limits!.latestEndSec
                    : bounds.nextStart}
                  onSeek={onSeek}
                  onApplyStructureEdit={onApplyStructureEdit}
                  onDeleteWords={onDeleteWords}
                  onAssignSegmentSheet={onAssignSegmentSheet}
                  onCreateSheet={onCreateSheet}
                  onResetSegmentLayout={onResetSegmentLayout}
                />
                {pickSnapshot.isActive && (
                  <ScenePickOverlay
                    selected={pickSelection.committed.has(segment.id)}
                    preview={pickSelection.preview.has(segment.id)}
                    accentColor={HOOK_SHEET_COLOR}
                    onClick={() => scenePickController.selectAt(segment.id, orderedSceneIds)}
                    onHoverEnter={() => scenePickController.hoverBoundary(segment.id)}
                    onHoverLeave={() => scenePickController.hoverBoundary(null)}
                  />
                )}
                {bulkSelection !== null && (
                  <BulkSceneOverlay
                    selected={bulkSelection.has(segment.id)}
                    onClick={(extendRange) => onToggleBulkScene?.(segment.id, extendRange)}
                  />
                )}
              </div>
              {bulkSelection === null && (
                <AddSceneButton
                  onClick={() => onInsertSegment(segment.id, 'after')}
                  label={isLastInList ? 'Add scene at end' : 'Add scene'}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
});

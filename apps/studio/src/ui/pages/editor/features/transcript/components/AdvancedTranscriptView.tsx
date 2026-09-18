import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import type { Document, Segment } from '@tscaps/engine';
import type { Sheet } from '@core/sheets/domain/Sheet';
import type { ElementStyles } from '@core/elements/domain/ElementStyles';
import type { BehindActorSegmentOverrideRegistry } from '@core/person-segmentation/domain/BehindActorSegmentOverrideRegistry';
import type { FrozenSegmentSet } from '@core/captions/domain/FrozenSegmentSet';
import type { DecorationOverrideRegistry } from '@core/captions/domain/DecorationOverrideRegistry';
import type { CutRegistry } from '@core/cuts/domain/CutRegistry';
import type { CutAwareDocumentBuilder } from '@core/cuts/services/CutAwareDocumentBuilder';
import { HOOK_SHEET_COLOR } from '@core/sheets/domain/Sheet';
import { useScrollParent } from '@ui/_shared/hooks/useScrollParent';
import type { SortedEntry } from "@ui/pages/editor/features/transcript/components/TranscriptPanel";
import { SegmentEditItem } from '@ui/pages/editor/features/transcript/components/segments/SegmentEditItem';
import { AddSceneButton } from '@ui/pages/editor/features/transcript/components/scenes/AddSceneButton';
import { ScenePickOverlay } from '@ui/pages/editor/features/transcript/components/pick-mode/ScenePickOverlay';
import { useTranscriptAutoScroll } from '@ui/pages/editor/features/transcript/hooks/useTranscriptAutoScroll';
import type { ScrollRequest } from '@ui/pages/editor/hooks/useSegmentSearchControls';
import { useScenePickController } from '@ui/pages/editor/features/transcript/contexts/ScenePickContext';
import { useCaptions } from '@ui/_shared/contexts/modules/CaptionsContext';
import { useScenePickSnapshot } from '@ui/pages/editor/features/transcript/hooks/useScenePickSnapshot';
import { useEffectivePickSelection } from '@ui/pages/editor/features/transcript/hooks/useEffectivePickSelection';
import { BulkSceneOverlay } from '@ui/pages/editor/features/transcript/components/bulk-mode/BulkSceneOverlay';

interface AdvancedTranscriptViewProps {
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
  onSeek: (time: number) => void;
  onEditWordText: (wordId: string, text: string) => void;
  onEditWordTime: (wordId: string, start: number, end: number) => void;
  onEditWordTags: (wordId: string, tagNames: ReadonlySet<string>) => void;
  onDeleteWords: (wordIds: string[]) => void;
  onApplyStructureEdit: (doc: Document) => void;
  onInsertWord: (segIdx: number, lineIdx: number, wordIdx: number) => string;
  onInsertSegment: (anchorRef: string | number | null, position: 'before' | 'after') => string;
  onAssignSegmentSheet: (segment: Segment, sheetId: string) => void;
  onCreateSheet: (name: string) => string | null;
  onCommitSegmentTime: (segmentId: string, start: number, end: number) => void;
  onRedistributeWords: (segmentId: string) => void;
  onResetSegmentLayout: (segmentId: string) => void;
  bulkTarget?: 'scenes' | 'words' | null;
  bulkSelection?: ReadonlySet<string>;
  onToggleBulkItem?: (id: string, extendRange: boolean) => void;
}

const EMPTY_SELECTION: ReadonlySet<string> = new Set();

export const AdvancedTranscriptView = memo(function AdvancedTranscriptView({
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
  onSeek,
  onEditWordText,
  onEditWordTime,
  onEditWordTags,
  onDeleteWords,
  onApplyStructureEdit,
  onInsertWord,
  onInsertSegment,
  onAssignSegmentSheet,
  onCreateSheet,
  onCommitSegmentTime,
  onRedistributeWords,
  onResetSegmentLayout,
  bulkTarget = null,
  bulkSelection = EMPTY_SELECTION,
  onToggleBulkItem,
}: AdvancedTranscriptViewProps) {
  const [activeWordId, setActiveWordId] = useState<string | null>(null);
  const [activePopoverId, setActivePopoverId] = useState<string | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!activeWordId && !activePopoverId) return;
    const close = (e: MouseEvent) => {
      const target = e.target as Element | null;
      if (rootRef.current?.contains(target)) return;
      // Floating layers (popovers, dialogs, etc.) are portaled to body and
      // fall outside `rootRef`. Without this check, a mousedown on one of
      // their options would unmount the layer before its `click` could fire,
      // making every option appear broken. New overlay components must mark
      // their portaled root with `data-floating-layer`.
      if (target?.closest?.('[data-floating-layer]')) return;
      setActiveWordId(null);
      setActivePopoverId(null);
    };
    window.addEventListener('mousedown', close);
    return () => window.removeEventListener('mousedown', close);
  }, [activeWordId, activePopoverId]);

  const handleInsertSegment = useCallback((anchorRef: string | number | null, position: 'before' | 'after') => {
    const newWordId = onInsertSegment(anchorRef, position);
    if (newWordId) {
      setActiveWordId(newWordId);
      setActivePopoverId(null);
    }
  }, [onInsertSegment]);

  const scenePickController = useScenePickController();
  const pickSnapshot = useScenePickSnapshot();
  // The slider's stops, from the same rule the write is clamped to: the
  // hard time of the neighbours **on this segment's own sheet**. Reading
  // the neighbours off the flat list instead stopped at whichever segment
  // happened to sit next in the document, and at its padded window rather
  // than the part of it that is defended.
  const { segmentTimeBounds } = useCaptions().services;
  const visibleDocument = useMemo(
    () => cutAwareDocumentBuilder.build(document, cuts),
    [cutAwareDocumentBuilder, document, cuts],
  );
  const segmentLimits = useMemo(
    () => segmentTimeBounds.allLimits(visibleDocument, videoDuration),
    [segmentTimeBounds, visibleDocument, videoDuration],
  );
  const orderedSceneIds = useMemo<ReadonlyArray<string>>(
    () => sorted.map((e) => e.segment.id),
    [sorted],
  );
  const pickSelection = useEffectivePickSelection(pickSnapshot, orderedSceneIds);

  const [parentRef, scrollEl] = useScrollParent();
  const virtualizer = useVirtualizer({
    count: sorted.length,
    getScrollElement: () => scrollEl,
    estimateSize: () => 180,
    overscan: 4,
    // Tie measurements to segment identity, not to position. Without this,
    // inserting/removing a scene shifts every later item to a new index
    // while their cached heights stay glued to the old index — producing
    // overlapping cards, missing "+" buttons, and stray gaps.
    getItemKey: (index) => sorted[index]!.segment.id,
  });

  useTranscriptAutoScroll({
    virtualizer, scrollReady: !!scrollEl, sorted, activeSegmentId, isPlaying, scrollRequest,
    pickActive: pickSnapshot.isActive || bulkTarget !== null,
  });

  const items = virtualizer.getVirtualItems();

  if (sorted.length === 0) {
    return (
      <div className="flex flex-col gap-2 py-4 pl-1">
        <p className="text-sm text-fg-muted text-center m-0">No captions yet.</p>
        <AddSceneButton
          onClick={() => handleInsertSegment(null, 'before')}
          label="Add first scene"
        />
      </div>
    );
  }

  return (
    <div
      ref={rootRef}
      className="flex flex-col"
      onClick={() => { setActiveWordId(null); setActivePopoverId(null); }}
    >
      <div ref={parentRef} className="flex flex-col py-2 pl-1">
        <div style={{ height: virtualizer.getTotalSize(), position: 'relative', width: '100%' }}>
          {items.map((vi) => {
            const entry = sorted[vi.index]!;
            const { segment, flatIdx, sectionKind } = entry;
            const sheet = sheets.find((s) => s.id === sectionKind) ?? null;
            const isActive = activeSegmentId === segment.id;
            const isLastFlat = flatIdx === sorted.length - 1;
            const isFirstFlat = flatIdx === 0;
            const prev = sorted[vi.index - 1]?.segment;
            const next = sorted[vi.index + 1]?.segment;
            const limits = segmentLimits.get(segment.id);
            const prevEnd = limits?.earliestStartSec ?? (prev ? prev.time.end : 0);
            const nextStart = Number.isFinite(limits?.latestEndSec ?? Infinity)
              ? limits!.latestEndSec
              : (next ? next.time.start : (videoDuration > 0 ? videoDuration : segment.time.end));
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
                {bulkTarget === null && isFirstInList && (
                  <AddSceneButton
                    onClick={() => handleInsertSegment(segment.id, 'before')}
                    label="Add scene at start"
                  />
                )}
                <div className={`relative ${highlightedSegmentId === segment.id ? 'rounded-sm ring-2 ring-accent ring-offset-2 ring-offset-surface-1' : ''}`}>
                  <SegmentEditItem
                    doc={document}
                    segment={segment}
                    segIdx={flatIdx}
                    isLastSegment={isLastFlat}
                    isFirstSegment={isFirstFlat}
                    isActive={isActive}
                    activeWordId={activeWordId}
                    activePopoverId={activePopoverId}
                    sheet={sheet}
                    sheets={sheets}
                    elementStyles={elementStyles}
                    behindActorOverrides={behindActorOverrides}
                    isFrozen={frozenSegments.has(segment.id)}
                    decorationOverrides={decorationOverrides}
                    cuts={cuts}
                    prevSegmentEnd={prevEnd}
                    nextSegmentStart={nextStart}
                    videoDuration={videoDuration}
                    onSeek={onSeek}
                    onActivateWord={setActiveWordId}
                    onActivatePopover={setActivePopoverId}
                    onEditWordText={onEditWordText}
                    onEditWordTime={onEditWordTime}
                    onEditWordTags={onEditWordTags}
                    onDeleteWords={onDeleteWords}
                    onApplyStructureEdit={onApplyStructureEdit}
                    onInsertWord={onInsertWord}
                    onAssignSegmentSheet={onAssignSegmentSheet}
                    onCreateSheet={onCreateSheet}
                    onCommitSegmentTime={onCommitSegmentTime}
                    onRedistributeWords={onRedistributeWords}
                    onResetSegmentLayout={onResetSegmentLayout}
                    bulkSelectedWordIds={bulkTarget === 'words' ? bulkSelection : null}
                    onToggleBulkWord={onToggleBulkItem}
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
                  {bulkTarget === 'scenes' && (
                    <BulkSceneOverlay
                      selected={bulkSelection.has(segment.id)}
                      onClick={(extendRange) => onToggleBulkItem?.(segment.id, extendRange)}
                    />
                  )}
                </div>
                {bulkTarget === null && (
                  <AddSceneButton
                    onClick={() => handleInsertSegment(segment.id, 'after')}
                    label={isLastInList ? 'Add scene at end' : 'Add scene'}
                  />
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
});

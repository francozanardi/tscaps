import { memo, useCallback, useEffect, useRef, useState } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import type { Document, Segment } from '@tscaps/engine';
import type { Sheet } from '@core/sheets/domain/Sheet';
import type { WordStyleOverrides } from '@core/captions/domain/WordStyleOverrides';
import type { WordStyleOverrideRegistry } from '@core/captions/domain/WordStyleOverrideRegistry';
import type { SegmentStyleOverrides } from '@core/captions/domain/SegmentStyleOverrides';
import type { SegmentOverrides } from '@core/captions/domain/SegmentOverrides';
import type { DecorationOverrideRegistry } from '@core/captions/domain/DecorationOverrideRegistry';
import { useScrollParent } from '@ui/_shared/hooks/useScrollParent';
import type { SortedEntry } from "@ui/pages/editor/features/captions/components/CaptionsPanel";
import { SegmentEditItem } from '@ui/pages/editor/features/captions/components/segments/SegmentEditItem';
import { AddSceneButton } from '@ui/pages/editor/features/captions/components/scenes/AddSceneButton';
import { useCaptionsAutoScroll, type ScrollRequest } from '@ui/pages/editor/features/captions/hooks/useCaptionsAutoScroll';

interface AdvancedCaptionsViewProps {
  document: Document;
  sorted: SortedEntry[];
  activeSegmentId: string | null;
  isPlaying: boolean;
  scrollRequest: ScrollRequest | null;
  highlightedSegmentId: string | null;
  sheets: Sheet[];
  wordStyleOverrides: WordStyleOverrideRegistry;
  segmentOverrides: SegmentOverrides;
  decorationOverrides: DecorationOverrideRegistry;
  videoDuration: number;
  onSeek: (time: number) => void;
  onEditWordText: (wordId: string, text: string) => void;
  onEditWordTime: (wordId: string, start: number, end: number) => void;
  onEditWordTags: (wordId: string, tagNames: ReadonlySet<string>) => void;
  onSetWordStyleOverride: (wordId: string, overrides: WordStyleOverrides) => void;
  onSetSegmentStyleOverride: (segmentId: string, overrides: SegmentStyleOverrides) => void;
  onDeleteWords: (wordIds: string[]) => void;
  onApplyStructureEdit: (doc: Document) => void;
  onInsertWord: (segIdx: number, lineIdx: number, wordIdx: number) => string;
  onInsertSegment: (segIdx: number, position: 'before' | 'after') => string;
  onAssignSegmentSheet: (segment: Segment, sheetId: string) => void;
  onCreateSheet: (name: string) => string | null;
  onCommitSegmentTime: (segmentId: string, start: number, end: number) => void;
  onRedistributeWords: (segmentId: string) => void;
  onResetSegmentLayout: (segmentId: string) => void;
}

export const AdvancedCaptionsView = memo(function AdvancedCaptionsView({
  document,
  sorted,
  activeSegmentId,
  isPlaying,
  scrollRequest,
  highlightedSegmentId,
  sheets,
  wordStyleOverrides,
  segmentOverrides,
  decorationOverrides,
  videoDuration,
  onSeek,
  onEditWordText,
  onEditWordTime,
  onEditWordTags,
  onSetWordStyleOverride,
  onSetSegmentStyleOverride,
  onDeleteWords,
  onApplyStructureEdit,
  onInsertWord,
  onInsertSegment,
  onAssignSegmentSheet,
  onCreateSheet,
  onCommitSegmentTime,
  onRedistributeWords,
  onResetSegmentLayout,
}: AdvancedCaptionsViewProps) {
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

  const handleInsertSegment = useCallback((segIdx: number, position: 'before' | 'after') => {
    const newWordId = onInsertSegment(segIdx, position);
    if (newWordId) {
      setActiveWordId(newWordId);
      setActivePopoverId(null);
    }
  }, [onInsertSegment]);

  const [parentRef, scrollEl] = useScrollParent();
  // eslint-disable-next-line react-hooks/incompatible-library -- @tanstack/react-virtual is not analyzable by the React Compiler.
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

  useCaptionsAutoScroll({ virtualizer, scrollReady: !!scrollEl, sorted, activeSegmentId, isPlaying, scrollRequest });

  const items = virtualizer.getVirtualItems();

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
            const prevEnd = prev ? prev.time.end : 0;
            const nextStart = next ? next.time.start : (videoDuration > 0 ? videoDuration : segment.time.end);
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
                    onClick={() => handleInsertSegment(flatIdx, 'before')}
                    label="Add scene at start"
                  />
                )}
                <div className={highlightedSegmentId === segment.id ? 'rounded-sm ring-2 ring-accent ring-offset-2 ring-offset-surface-1' : undefined}>
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
                    wordStyleOverrides={wordStyleOverrides}
                    segmentOverrides={segmentOverrides}
                    decorationOverrides={decorationOverrides}
                    prevSegmentEnd={prevEnd}
                    nextSegmentStart={nextStart}
                    videoDuration={videoDuration}
                    onSeek={onSeek}
                    onActivateWord={setActiveWordId}
                    onActivatePopover={setActivePopoverId}
                    onEditWordText={onEditWordText}
                    onEditWordTime={onEditWordTime}
                    onEditWordTags={onEditWordTags}
                    onSetWordStyleOverride={onSetWordStyleOverride}
                    onSetSegmentStyleOverride={onSetSegmentStyleOverride}
                    onDeleteWords={onDeleteWords}
                    onApplyStructureEdit={onApplyStructureEdit}
                    onInsertWord={onInsertWord}
                    onAssignSegmentSheet={onAssignSegmentSheet}
                    onCreateSheet={onCreateSheet}
                    onCommitSegmentTime={onCommitSegmentTime}
                    onRedistributeWords={onRedistributeWords}
                    onResetSegmentLayout={onResetSegmentLayout}
                  />
                </div>
                <AddSceneButton
                  onClick={() => handleInsertSegment(flatIdx, 'after')}
                  label={isLastInList ? 'Add scene at end' : 'Add scene'}
                />
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
});

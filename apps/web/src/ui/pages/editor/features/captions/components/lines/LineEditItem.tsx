import { memo, useCallback } from 'react';
import { MoreHorizontal } from 'lucide-react';
import type { Document, Line, Segment } from '@tscaps/engine';
import type { Sheet } from '@core/sheets/domain/Sheet';
import type { WordStyleOverrides } from '@core/captions/domain/WordStyleOverrides';
import type { WordStyleOverrideRegistry } from '@core/captions/domain/WordStyleOverrideRegistry';
import type { SegmentOverrides } from '@core/captions/domain/SegmentOverrides';
import { WordPopover } from '@ui/pages/editor/features/captions/components/words/WordPopover';
import { WordChip } from '@ui/pages/editor/features/captions/components/words/WordChip';
import { LineSettingsPopover } from '@ui/pages/editor/features/captions/components/lines/LineSettingsPopover';
import { Tooltip } from '@ui/_shared/components/Tooltip/Tooltip';
import { settingsBtnClass } from '@ui/pages/editor/features/captions/captions-classes';
import { wordTimeBoundsInSegment } from '@ui/pages/editor/features/captions/utils';
import { useEngine } from '@ui/_shared/contexts/modules/EngineContext';

export interface LineEditItemProps {
  doc: Document;
  segment: Segment;
  line: Line;
  lineIdx: number;
  segIdx: number;
  isLastLine: boolean;
  isFirstSegment: boolean;
  isLastSegment: boolean;
  videoDuration: number;
  activeWordId: string | null;
  activePopoverId: string | null;
  sheet: Sheet | null;
  wordStyleOverrides: WordStyleOverrideRegistry;
  segmentOverrides: SegmentOverrides;
  onActivateWord: (id: string | null) => void;
  onActivatePopover: (id: string | null) => void;
  onEditWordText: (wordId: string, text: string) => void;
  onEditWordTime: (wordId: string, start: number, end: number) => void;
  onEditWordTags: (wordId: string, tagNames: ReadonlySet<string>) => void;
  onSetWordStyleOverride: (wordId: string, overrides: WordStyleOverrides) => void;
  onDeleteWords: (wordIds: string[]) => void;
  onApplyStructureEdit: (doc: Document) => void;
  onInsertWord: (segIdx: number, lineIdx: number, wordIdx: number) => string;
}

/**
 * Memoized with custom equality so a per-word override change in another
 * line doesn't re-render this line's Tooltip/Popover machinery (the dominant
 * cost during color drags). The registry's `get(wordId)` returns a stable
 * reference for words whose overrides did not change, so iterating this
 * line's words is enough to decide.
 */
function LineEditItemImpl({ doc, segment, line, lineIdx, segIdx, isLastLine, isFirstSegment, isLastSegment, videoDuration, activeWordId, activePopoverId, sheet, wordStyleOverrides, segmentOverrides, onActivateWord, onActivatePopover, onEditWordText, onEditWordTime, onEditWordTags, onSetWordStyleOverride, onDeleteWords, onApplyStructureEdit, onInsertWord }: LineEditItemProps) {
  const { documentEditor } = useEngine();
  const settingsId = `line:${line.id}`;
  const isSettingsOpen = activePopoverId === settingsId;

  // Stable handler so `WordChip`'s `memo()` keeps its skip across re-renders
  // — an inline closure would change identity on every render and force every
  // chip to re-render on each store tick (which is exactly the perf path the
  // memoization is here to cut).
  const handleActivateWord = useCallback((id: string, currentlyActive: boolean) => {
    onActivateWord(currentlyActive ? null : id);
    onActivatePopover(null);
  }, [onActivateWord, onActivatePopover]);

  const handleSettingsOpenChange = useCallback((next: boolean) => {
    if (next) { onActivatePopover(settingsId); onActivateWord(null); }
    else { onActivatePopover(null); }
  }, [onActivatePopover, onActivateWord, settingsId]);

  const handleWordOpenChange = useCallback((open: boolean) => {
    if (!open) onActivateWord(null);
  }, [onActivateWord]);

  return (
    <div className="group/line flex items-start gap-1.5 px-2 py-[5px] bg-surface-0 border border-edge-medium rounded-xs flex-wrap transition-colors duration-quick ease-standard hover:border-edge-strong">
      <div className="flex flex-nowrap gap-[3px] flex-1 min-w-0 overflow-x-auto [scrollbar-width:thin] [scrollbar-color:rgb(var(--color-edge-medium))_transparent]">
        {line.words.map((word, wordIdx) => {
          const isActive = activeWordId === word.id;
          const chip = (
            <WordChip
              wordId={word.id}
              text={word.text}
              isActive={isActive}
              hasOverride={wordStyleOverrides.hasAnyFor(word.id)}
              onActivate={handleActivateWord}
            />
          );
          // Lazy-mount the WordPopover only for the active word.
          if (!sheet || !isActive) {
            return (
              <span key={word.id} className="inline-flex flex-col">
                {chip}
              </span>
            );
          }
          const bounds = wordTimeBoundsInSegment(doc, segment, word.id, videoDuration);
          return (
            <WordPopover
              key={word.id}
              open={isActive}
              onOpenChange={handleWordOpenChange}
              trigger={<span className="inline-flex flex-col">{chip}</span>}
              word={word}
              isLastWordInLine={wordIdx === line.words.length - 1}
              sheet={sheet}
              segment={segment}
              segmentOverrides={segmentOverrides}
              currentOverrides={wordStyleOverrides.get(word.id)}
              prevWordEnd={bounds.prevEnd}
              nextWordStart={bounds.nextStart}
              onCommitText={(text) => onEditWordText(word.id, text)}
              onCommitTime={(start, end) => onEditWordTime(word.id, start, end)}
              onCommitTags={(names) => onEditWordTags(word.id, names)}
              onCommitStyleOverrides={(o) => onSetWordStyleOverride(word.id, o)}
              onAddLineBreakAfter={() => onApplyStructureEdit(documentEditor.splitLineAfterWord(doc, segIdx, lineIdx, wordIdx))}
              onJoinWithNextLine={wordIdx === line.words.length - 1 && !isLastLine
                ? () => onApplyStructureEdit(documentEditor.mergeLineWithNext(doc, segIdx, lineIdx))
                : undefined}
              onAddWordAfter={() => {
                const wordId = onInsertWord(segIdx, lineIdx, wordIdx);
                onActivateWord(wordId);
              }}
              onMoveToPrevLine={wordIdx === 0 && lineIdx > 0
                ? () => onApplyStructureEdit(documentEditor.moveFirstWordToPrevLine(doc, segIdx, lineIdx))
                : undefined}
              onMoveToNextLine={wordIdx === line.words.length - 1 && !isLastLine
                ? () => onApplyStructureEdit(documentEditor.moveLastWordToNextLine(doc, segIdx, lineIdx))
                : undefined}
              onMoveToPrevBlock={wordIdx === 0 && lineIdx === 0 && !isFirstSegment
                ? () => onApplyStructureEdit(documentEditor.moveFirstWordToPrevSegment(doc, segIdx))
                : undefined}
              onMoveToNextBlock={wordIdx === line.words.length - 1 && isLastLine && !isLastSegment
                ? () => onApplyStructureEdit(documentEditor.moveLastWordToNextSegment(doc, segIdx))
                : undefined}
              onDelete={() => onDeleteWords([word.id])}
            />
          );
        })}
      </div>
      <div className="flex gap-[3px] shrink-0 self-center">
        {isSettingsOpen ? (
          <LineSettingsPopover
            open={isSettingsOpen}
            onOpenChange={handleSettingsOpenChange}
            trigger={
              <button
                className={settingsBtnClass(isSettingsOpen, 'line')}
                onClick={(e) => e.stopPropagation()}
              >
                <MoreHorizontal size={12} />
              </button>
            }
            triggerTooltip="Line options"
            doc={doc}
            segIdx={segIdx}
            lineIdx={lineIdx}
            line={line}
            isLastLine={isLastLine}
            isFirstSegment={isFirstSegment}
            isLastSegment={isLastSegment}
            onDeleteWords={onDeleteWords}
            onApplyStructureEdit={onApplyStructureEdit}
          />
        ) : (
          // Idle: bare button wrapped in Tooltip — defers mounting the
          // RadixPopover.Root until first activation.
          <Tooltip text="Line options">
            <button
              className={settingsBtnClass(false, 'line')}
              onClick={(e) => { e.stopPropagation(); handleSettingsOpenChange(true); }}
            >
              <MoreHorizontal size={12} />
            </button>
          </Tooltip>
        )}
      </div>
    </div>
  );
}

function lineEditItemPropsEqual(prev: LineEditItemProps, next: LineEditItemProps): boolean {
  if (prev.doc !== next.doc) return false;
  if (prev.segment !== next.segment) return false;
  if (prev.line !== next.line) return false;
  if (prev.lineIdx !== next.lineIdx) return false;
  if (prev.segIdx !== next.segIdx) return false;
  if (prev.isLastLine !== next.isLastLine) return false;
  if (prev.isFirstSegment !== next.isFirstSegment) return false;
  if (prev.isLastSegment !== next.isLastSegment) return false;
  if (prev.videoDuration !== next.videoDuration) return false;
  if (prev.activeWordId !== next.activeWordId) return false;
  if (prev.activePopoverId !== next.activePopoverId) return false;
  if (prev.sheet !== next.sheet) return false;
  if (prev.onActivateWord !== next.onActivateWord) return false;
  if (prev.onActivatePopover !== next.onActivatePopover) return false;
  if (prev.onEditWordText !== next.onEditWordText) return false;
  if (prev.onEditWordTime !== next.onEditWordTime) return false;
  if (prev.onEditWordTags !== next.onEditWordTags) return false;
  if (prev.onSetWordStyleOverride !== next.onSetWordStyleOverride) return false;
  if (prev.onDeleteWords !== next.onDeleteWords) return false;
  if (prev.onApplyStructureEdit !== next.onApplyStructureEdit) return false;
  if (prev.onInsertWord !== next.onInsertWord) return false;
  if (prev.wordStyleOverrides !== next.wordStyleOverrides) {
    for (const word of next.line.words) {
      if (prev.wordStyleOverrides.get(word.id) !== next.wordStyleOverrides.get(word.id)) return false;
    }
  }
  // Only re-render when this segment's overrides change — the
  // WordPopover's baseline derives from them, so a per-segment edit
  // elsewhere in the doc must not invalidate this line.
  if (prev.segmentOverrides !== next.segmentOverrides
    && prev.segmentOverrides.getStyle(next.segment.id) !== next.segmentOverrides.getStyle(next.segment.id)) {
    return false;
  }
  return true;
}

export const LineEditItem = memo(LineEditItemImpl, lineEditItemPropsEqual);

import { memo, useCallback } from 'react';
import { Loader2, Lock, MoreHorizontal } from 'lucide-react';
import type { Document, Segment } from '@tscaps/engine';
import type { Sheet } from '@core/sheets/domain/Sheet';
import type { WordStyleOverrides } from '@core/captions/domain/WordStyleOverrides';
import type { WordStyleOverrideRegistry } from '@core/captions/domain/WordStyleOverrideRegistry';
import type { SegmentStyleOverrides } from '@core/captions/domain/SegmentStyleOverrides';
import type { SegmentOverrides } from '@core/captions/domain/SegmentOverrides';
import type { DecorationOverrideRegistry } from '@core/captions/domain/DecorationOverrideRegistry';
import type { CutRegistry } from '@core/cuts/domain/CutRegistry';
import { formatTime } from '@ui/pages/editor/features/transcript/utils';
import { useRenderTimeMap } from '@ui/_shared/contexts/modules/CutsContext';
import { LineEditItem } from '@ui/pages/editor/features/transcript/components/lines/LineEditItem';
import { SegmentSettingsPopover } from '@ui/pages/editor/features/transcript/components/segments/SegmentSettingsPopover';
import { SceneDecorationsRow } from '@ui/pages/editor/features/transcript/components/decorations/SceneDecorationsRow';
import { useSegmentMaskBackfillPending } from '@ui/pages/editor/features/person-segmentation/hooks/useSegmentMaskBackfillPending';
import { Tooltip } from '@ui/_shared/components/Tooltip/Tooltip';
import { settingsBtnClass } from '@ui/pages/editor/features/transcript/transcript-classes';

export interface SegmentEditItemProps {
  doc: Document;
  segment: Segment;
  segIdx: number;
  isLastSegment: boolean;
  isFirstSegment: boolean;
  isActive: boolean;
  activeWordId: string | null;
  activePopoverId: string | null;
  sheet: Sheet | null;
  sheets: Sheet[];
  wordStyleOverrides: WordStyleOverrideRegistry;
  segmentOverrides: SegmentOverrides;
  decorationOverrides: DecorationOverrideRegistry;
  cuts: CutRegistry;
  prevSegmentEnd: number;
  nextSegmentStart: number;
  videoDuration: number;
  onSeek: (time: number) => void;
  onActivateWord: (id: string | null) => void;
  onActivatePopover: (id: string | null) => void;
  onEditWordText: (wordId: string, text: string) => void;
  onEditWordTime: (wordId: string, start: number, end: number) => void;
  onEditWordTags: (wordId: string, tagNames: ReadonlySet<string>) => void;
  onSetWordStyleOverride: (wordId: string, overrides: WordStyleOverrides) => void;
  onSetSegmentStyleOverride: (segmentId: string, overrides: SegmentStyleOverrides) => void;
  onDeleteWords: (wordIds: string[]) => void;
  onApplyStructureEdit: (doc: Document) => void;
  onInsertWord: (segIdx: number, lineIdx: number, wordIdx: number) => string;
  onAssignSegmentSheet: (segment: Segment, sheetId: string) => void;
  onCreateSheet: (name: string) => string | null;
  onCommitSegmentTime: (segmentId: string, start: number, end: number) => void;
  onRedistributeWords: (segmentId: string) => void;
  onResetSegmentLayout: (segmentId: string) => void;
}

// Active state uses a neutral surface lift (no accent color) so it doesn't
// compete with the sheet-color stripe on the left edge. The "has overrides"
// signal lives in the header (a small accent dot next to the time), so the
// card frame stays uniform across overridden / non-overridden segments.
const SEG_CARD_IDLE = 'border border-edge-medium bg-surface-1 rounded-sm overflow-hidden shadow-sm transition-colors duration-quick ease-standard';
const SEG_CARD_ACTIVE = 'border border-edge-medium bg-surface-2 rounded-sm overflow-hidden shadow-sm transition-colors duration-quick ease-standard';
const SEG_HEADER_IDLE = 'group/seg-header flex items-center justify-between px-2.5 py-1.5 bg-surface-2 border-b border-edge-subtle gap-1.5 cursor-pointer transition-colors duration-quick ease-standard hover:bg-surface-3';
const SEG_HEADER_ACTIVE = 'group/seg-header flex items-center justify-between px-2.5 py-1.5 bg-surface-3 border-b border-edge-medium gap-1.5 cursor-pointer transition-colors duration-quick ease-standard hover:bg-surface-3';
// Solid accent fill, no halo — the accent token is theme-aware so the dot
// reads on both light and dark surfaces. Mirrors `WordChip`'s indicator.
const OVERRIDE_DOT = 'inline-block w-1.5 h-1.5 rounded-full bg-accent shrink-0';
const LOCK_BTN =
  'inline-flex items-center justify-center w-4 h-4 rounded-xs bg-transparent border-none p-0 shrink-0 cursor-pointer ' +
  'text-fg-faint transition-colors duration-quick ease-standard ' +
  'hover:text-fg-secondary hover:bg-surface-3 focus-visible:outline-none focus-visible:text-fg-secondary focus-visible:bg-surface-3';

/**
 * Memoized with custom equality so a per-word override change in another
 * segment doesn't re-render this segment's Tooltip/Popover machinery (which
 * dominated the React profile during color drags). The registry's
 * `get(wordId)` returns a stable reference for words whose overrides did
 * not change, so iterating this segment's words is enough to decide.
 */
function SegmentEditItemImpl({ doc, segment, segIdx, isLastSegment, isFirstSegment, isActive, activeWordId, activePopoverId, sheet, sheets, wordStyleOverrides, segmentOverrides, decorationOverrides, cuts, prevSegmentEnd, nextSegmentStart, videoDuration, onSeek, onActivateWord, onActivatePopover, onEditWordText, onEditWordTime, onEditWordTags, onSetWordStyleOverride, onSetSegmentStyleOverride, onDeleteWords, onApplyStructureEdit, onInsertWord, onAssignSegmentSheet, onCreateSheet, onCommitSegmentTime, onRedistributeWords, onResetSegmentLayout }: SegmentEditItemProps) {
  const timeMap = useRenderTimeMap();
  const isFrozen = segmentOverrides.isFrozen(segment.id);
  const isComputingActorMasks = useSegmentMaskBackfillPending(segment.id);
  const hasOverride = segmentOverrides.hasStyleFor(segment.id);
  const settingsId = `seg:${segment.id}`;
  const isSettingsOpen = activePopoverId === settingsId;

  const handleSettingsOpenChange = useCallback((next: boolean) => {
    if (next) { onActivatePopover(settingsId); onActivateWord(null); }
    else { onActivatePopover(null); }
  }, [onActivatePopover, onActivateWord, settingsId]);

  // Override only the left border so the chrome border on the other three
  // sides stays intact.
  const accentStyle = sheet?.color
    ? { borderLeftColor: sheet.color, borderLeftWidth: '3px' }
    : undefined;

  return (
    <div
      className={isActive ? SEG_CARD_ACTIVE : SEG_CARD_IDLE}
      style={accentStyle}
    >
      <div
        className={isActive ? SEG_HEADER_ACTIVE : SEG_HEADER_IDLE}
        onClick={() => onSeek(segment.time.midpoint)}
      >
        <span className="flex items-center gap-2 min-w-0">
          <span className="text-2xs text-fg-faint tabular-nums font-mono pointer-events-none">
            {formatTime(timeMap.toOutputTime(segment.time.start))} — {formatTime(timeMap.toOutputTime(segment.time.end))}
          </span>
          {hasOverride && (
            <Tooltip text="Has style overrides" position="top">
              <span className={OVERRIDE_DOT} aria-label="Has style overrides" />
            </Tooltip>
          )}
          {isFrozen && (
            <Tooltip text="Manual layout. Click to reset." position="top">
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); onResetSegmentLayout(segment.id); }}
                aria-label="Reset manual layout"
                className={LOCK_BTN}
              >
                <Lock size={11} />
              </button>
            </Tooltip>
          )}
          {isComputingActorMasks && (
            <Tooltip text="Preparing text behind actor…" position="top">
              <Loader2 size={11} className="animate-spin text-fg-faint shrink-0" aria-label="Preparing text behind actor" />
            </Tooltip>
          )}
        </span>
        <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
          <SceneDecorationsRow
            segment={segment}
            sheet={sheet}
            wordStyleOverrides={wordStyleOverrides}
            segmentOverrides={segmentOverrides}
            decorationOverrides={decorationOverrides}
          />
          {isSettingsOpen ? (
            <SegmentSettingsPopover
              open={isSettingsOpen}
              onOpenChange={handleSettingsOpenChange}
              trigger={
                <button
                  className={settingsBtnClass(isSettingsOpen, 'seg-header')}
                  onClick={(e) => e.stopPropagation()}
                >
                  <MoreHorizontal size={12} />
                </button>
              }
              triggerTooltip="Scene options"
              doc={doc}
              segment={segment}
              segIdx={segIdx}
              isFirstSegment={isFirstSegment}
              isLastSegment={isLastSegment}
              sheet={sheet}
              sheets={sheets}
              currentOverrides={segmentOverrides.getStyle(segment.id)}
              behindActorOverride={segmentOverrides.behindActorOverrideFor(segment.id)}
              prevSegmentEnd={prevSegmentEnd}
              nextSegmentStart={nextSegmentStart}
              onDeleteWords={onDeleteWords}
              onApplyStructureEdit={onApplyStructureEdit}
              onAssignSegmentSheet={onAssignSegmentSheet}
              onCreateSheet={onCreateSheet}
              onCommitStyleOverrides={(o) => onSetSegmentStyleOverride(segment.id, o)}
              onCommitSegmentTime={(start, end) => onCommitSegmentTime(segment.id, start, end)}
              onRedistributeWords={() => onRedistributeWords(segment.id)}
            />
          ) : (
            // Idle: bare button wrapped in Tooltip — defers mounting the
            // RadixPopover.Root until first activation.
            <Tooltip text="Scene options">
              <button
                className={settingsBtnClass(false, 'seg-header')}
                onClick={(e) => { e.stopPropagation(); handleSettingsOpenChange(true); }}
              >
                <MoreHorizontal size={12} />
              </button>
            </Tooltip>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-[3px] pt-1 px-1.5 pb-1.5">
        {segment.lines.map((line, lineIdx) => {
          if (line.words.every((w) => cuts.containsTimeRange(w.time.start, w.time.end))) {
            return null;
          }
          return (
            <LineEditItem
              key={line.id}
              doc={doc}
              segment={segment}
              line={line}
              lineIdx={lineIdx}
              segIdx={segIdx}
              isLastLine={lineIdx === segment.lines.length - 1}
              isFirstSegment={isFirstSegment}
              isLastSegment={isLastSegment}
              videoDuration={videoDuration}
              activeWordId={activeWordId}
              activePopoverId={activePopoverId}
              sheet={sheet}
              wordStyleOverrides={wordStyleOverrides}
              segmentOverrides={segmentOverrides}
              cuts={cuts}
              onActivateWord={onActivateWord}
              onActivatePopover={onActivatePopover}
              onEditWordText={onEditWordText}
              onEditWordTime={onEditWordTime}
              onEditWordTags={onEditWordTags}
              onSetWordStyleOverride={onSetWordStyleOverride}
              onDeleteWords={onDeleteWords}
              onApplyStructureEdit={onApplyStructureEdit}
              onInsertWord={onInsertWord}
            />
          );
        })}
      </div>
    </div>
  );
}

function segmentEditItemPropsEqual(prev: SegmentEditItemProps, next: SegmentEditItemProps): boolean {
  if (prev.doc !== next.doc) return false;
  if (prev.segment !== next.segment) return false;
  if (prev.segIdx !== next.segIdx) return false;
  if (prev.isLastSegment !== next.isLastSegment) return false;
  if (prev.isFirstSegment !== next.isFirstSegment) return false;
  if (prev.isActive !== next.isActive) return false;
  if (prev.activeWordId !== next.activeWordId) return false;
  if (prev.activePopoverId !== next.activePopoverId) return false;
  if (prev.videoDuration !== next.videoDuration) return false;
  if (prev.cuts !== next.cuts) return false;
  if (prev.sheet !== next.sheet) return false;
  if (prev.sheets !== next.sheets) return false;
  if (prev.onSeek !== next.onSeek) return false;
  if (prev.onActivateWord !== next.onActivateWord) return false;
  if (prev.onActivatePopover !== next.onActivatePopover) return false;
  if (prev.onEditWordText !== next.onEditWordText) return false;
  if (prev.onEditWordTime !== next.onEditWordTime) return false;
  if (prev.onEditWordTags !== next.onEditWordTags) return false;
  if (prev.onSetWordStyleOverride !== next.onSetWordStyleOverride) return false;
  if (prev.onSetSegmentStyleOverride !== next.onSetSegmentStyleOverride) return false;
  // SegmentOverrides composes style + freeze internally: compare the
  // segment-specific style entry (returns stable refs when unchanged)
  // AND the freeze flag, since freeze toggles re-render the lock icon.
  if (prev.segmentOverrides.getStyle(prev.segment.id) !== next.segmentOverrides.getStyle(next.segment.id)) return false;
  if (prev.segmentOverrides.isFrozen(prev.segment.id) !== next.segmentOverrides.isFrozen(next.segment.id)) return false;
  if (prev.segmentOverrides.behindActorOverrideFor(prev.segment.id) !== next.segmentOverrides.behindActorOverrideFor(next.segment.id)) return false;
  if (prev.onDeleteWords !== next.onDeleteWords) return false;
  if (prev.onApplyStructureEdit !== next.onApplyStructureEdit) return false;
  if (prev.onInsertWord !== next.onInsertWord) return false;
  if (prev.onAssignSegmentSheet !== next.onAssignSegmentSheet) return false;
  if (prev.onCreateSheet !== next.onCreateSheet) return false;
  if (prev.wordStyleOverrides !== next.wordStyleOverrides) {
    for (const line of next.segment.lines) {
      for (const word of line.words) {
        if (prev.wordStyleOverrides.get(word.id) !== next.wordStyleOverrides.get(word.id)) return false;
        if (word.decoration && prev.wordStyleOverrides.get(word.decoration.id) !== next.wordStyleOverrides.get(word.decoration.id)) return false;
      }
    }
  }
  if (prev.decorationOverrides !== next.decorationOverrides) {
    for (const line of next.segment.lines) {
      for (const word of line.words) {
        if (!word.decoration) continue;
        if (prev.decorationOverrides.get(word.decoration.id) !== next.decorationOverrides.get(word.decoration.id)) return false;
      }
    }
  }
  return true;
}

export const SegmentEditItem = memo(SegmentEditItemImpl, segmentEditItemPropsEqual);

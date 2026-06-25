import { memo, useCallback, useLayoutEffect, useMemo, useState } from 'react';
import { Lock, MoreHorizontal, Trash2 } from 'lucide-react';
import type { Document, Segment } from '@tscaps/engine';
import type { Sheet } from '@core/sheets/domain/Sheet';
import type { SegmentStyleOverrides } from '@core/captions/domain/SegmentStyleOverrides';
import type { SegmentOverrides } from '@core/captions/domain/SegmentOverrides';
import type { WordStyleOverrideRegistry } from '@core/captions/domain/WordStyleOverrideRegistry';
import type { DecorationOverrideRegistry } from '@core/captions/domain/DecorationOverrideRegistry';
import type { CutRegistry } from '@core/cuts/domain/CutRegistry';
import type { CutAwareDocumentBuilder } from '@core/cuts/services/CutAwareDocumentBuilder';
import type { TranscriptCallbacks } from '@ui/pages/editor/features/transcript/hooks/useTranscriptCallbacks';
import { useSceneEditor } from '@ui/pages/editor/features/transcript/hooks/useSceneEditor';
import { useIsMobileViewport } from '@ui/_shared/hooks/useIsMobileViewport';
import { Tooltip } from '@ui/_shared/components/Tooltip/Tooltip';
import { SegmentSettingsPopover } from '@ui/pages/editor/features/transcript/components/segments/SegmentSettingsPopover';
import { SceneDecorationsRow } from '@ui/pages/editor/features/transcript/components/decorations/SceneDecorationsRow';
import { formatTime } from '@ui/pages/editor/features/transcript/utils';
import { useEngine } from '@ui/_shared/contexts/modules/EngineContext';
import { useRenderTimeMap } from '@ui/_shared/contexts/modules/CutsContext';
import { settingsBtnClass } from '@ui/pages/editor/features/transcript/transcript-classes';

const CARD_IDLE = 'border border-edge-medium bg-surface-1 rounded-sm overflow-hidden shadow-sm transition-colors duration-quick ease-standard';
const CARD_ACTIVE = 'border border-edge-medium bg-surface-2 rounded-sm overflow-hidden shadow-sm transition-colors duration-quick ease-standard';
const HEADER_IDLE = 'group/seg-header flex items-center justify-between px-2.5 py-1.5 bg-surface-2 border-b border-edge-subtle gap-1.5 cursor-pointer transition-colors duration-quick ease-standard hover:bg-surface-3';
const HEADER_ACTIVE = 'group/seg-header flex items-center justify-between px-2.5 py-1.5 bg-surface-3 border-b border-edge-medium gap-1.5 cursor-pointer transition-colors duration-quick ease-standard hover:bg-surface-3';
const OVERRIDE_DOT = 'inline-block w-1.5 h-1.5 rounded-full bg-accent shrink-0';
const LOCK_BTN =
  'inline-flex items-center justify-center w-4 h-4 rounded-xs bg-transparent border-none p-0 shrink-0 cursor-pointer ' +
  'text-fg-faint transition-colors duration-quick ease-standard ' +
  'hover:text-fg-secondary hover:bg-surface-3 focus-visible:outline-none focus-visible:text-fg-secondary focus-visible:bg-surface-3';
const TRASH_BTN =
  'inline-flex items-center justify-center w-6 h-6 rounded-xs bg-transparent border-none text-fg-faint ' +
  'cursor-pointer transition-colors duration-quick ease-standard ' +
  'hover:bg-danger/15 hover:text-danger focus-visible:outline-none focus-visible:bg-danger/15 focus-visible:text-danger';

export interface SceneCardProps {
  doc: Document;
  segment: Segment;
  segIdx: number;
  isFirstSegment: boolean;
  isLastSegment: boolean;
  isActive: boolean;
  sheet: Sheet | null;
  sheets: Sheet[];
  wordStyleOverrides: WordStyleOverrideRegistry;
  segmentOverrides: SegmentOverrides;
  decorationOverrides: DecorationOverrideRegistry;
  cuts: CutRegistry;
  cutAwareDocumentBuilder: CutAwareDocumentBuilder;
  captions: TranscriptCallbacks;
  prevSegmentEnd: number;
  nextSegmentStart: number;
  onSeek: (time: number) => void;
  onApplyStructureEdit: (doc: Document) => void;
  onDeleteWords: (wordIds: string[]) => void;
  onAssignSegmentSheet: (segment: Segment, sheetId: string) => void;
  onCreateSheet: (name: string) => string | null;
  onSetSegmentStyleOverride: (segmentId: string, overrides: SegmentStyleOverrides) => void;
  onResetSegmentLayout: (segmentId: string) => void;
}

export const SceneCard = memo(function SceneCard(props: SceneCardProps) {
  const {
    doc, segment, segIdx, isFirstSegment, isLastSegment, isActive,
    sheet, sheets, wordStyleOverrides, segmentOverrides, decorationOverrides,
    cuts, cutAwareDocumentBuilder, captions,
    prevSegmentEnd, nextSegmentStart,
    onSeek, onApplyStructureEdit, onDeleteWords,
    onAssignSegmentSheet, onCreateSheet, onSetSegmentStyleOverride, onResetSegmentLayout,
  } = props;

  const { documentEditor } = useEngine();
  const timeMap = useRenderTimeMap();
  const isFrozen = segmentOverrides.isFrozen(segment.id);
  const hasOverride = segmentOverrides.hasStyleFor(segment.id);

  // Header time, textarea seed and recompile edits operate on the
  // post-cuts view of this scene; restoring a cut after the user has
  // typed will not bring those words back into the document.
  const visibleSegment = useMemo(
    () => cutAwareDocumentBuilder.buildSegment(segment, cuts) ?? segment,
    [cutAwareDocumentBuilder, segment, cuts],
  );

  const isMobile = useIsMobileViewport();
  const { value, textareaRef, onChange, onKeyDown, onFocus, onBlur } = useSceneEditor(visibleSegment, captions);
  const [settingsOpen, setSettingsOpen] = useState(false);

  useLayoutEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.setProperty('height', '0px');
    ta.style.setProperty('height', `${ta.scrollHeight}px`);
  }, [value, textareaRef]);

  const accentStyle = sheet?.color
    ? { borderLeftColor: sheet.color, borderLeftWidth: '3px' }
    : undefined;

  const handleSeek = useCallback(() => {
    onSeek(visibleSegment.time.midpoint);
  }, [onSeek, visibleSegment.time.midpoint]);

  // Surfacing the segment in the preview when its textarea takes focus
  // (click, tab, arrow-key navigation). Skipped while already active so
  // typing or hopping into a segment that's currently playing doesn't
  // yank the playhead.
  const handleTextareaFocus = useCallback(() => {
    onFocus();
    if (!isActive) onSeek(visibleSegment.time.midpoint);
  }, [onFocus, isActive, onSeek, visibleSegment.time.midpoint]);

  const handleDelete = useCallback(() => {
    onApplyStructureEdit(documentEditor.deleteSegment(doc, segIdx));
  }, [doc, documentEditor, onApplyStructureEdit, segIdx]);

  const handleCommitSegmentTime = useCallback((start: number, end: number) => {
    captions.editSegmentTime({ segmentId: segment.id, start, end });
  }, [captions, segment.id]);

  const handleRedistributeWords = useCallback(() => {
    captions.redistributeWords(segment.id);
  }, [captions, segment.id]);

  return (
    <div data-scene-card className={isActive ? CARD_ACTIVE : CARD_IDLE} style={accentStyle}>
      <div className={isActive ? HEADER_ACTIVE : HEADER_IDLE} onClick={handleSeek}>
        <span className="flex items-center gap-2 min-w-0">
          <span className="text-2xs text-fg-faint tabular-nums font-mono pointer-events-none">
            {formatTime(timeMap.toOutputTime(visibleSegment.time.start))} — {formatTime(timeMap.toOutputTime(visibleSegment.time.end))}
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
        </span>
        <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
          <SceneDecorationsRow
            segment={segment}
            sheet={sheet}
            wordStyleOverrides={wordStyleOverrides}
            segmentOverrides={segmentOverrides}
            decorationOverrides={decorationOverrides}
          />
          {isMobile ? (
            <button
              type="button"
              onClick={handleDelete}
              aria-label="Delete scene"
              className={TRASH_BTN}
            >
              <Trash2 size={14} />
            </button>
          ) : (
            <SegmentSettingsPopover
              open={settingsOpen}
              onOpenChange={setSettingsOpen}
              trigger={
                <button
                  className={settingsBtnClass(settingsOpen, 'seg-header')}
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
              prevSegmentEnd={prevSegmentEnd}
              nextSegmentStart={nextSegmentStart}
              onDeleteWords={onDeleteWords}
              onApplyStructureEdit={onApplyStructureEdit}
              onAssignSegmentSheet={onAssignSegmentSheet}
              onCreateSheet={onCreateSheet}
              onCommitStyleOverrides={(o) => onSetSegmentStyleOverride(segment.id, o)}
              onCommitSegmentTime={handleCommitSegmentTime}
              onRedistributeWords={handleRedistributeWords}
            />
          )}
        </div>
      </div>

      <textarea
        ref={textareaRef}
        data-segment-id={segment.id}
        value={value}
        onChange={onChange}
        onKeyDown={onKeyDown}
        onFocus={handleTextareaFocus}
        onBlur={onBlur}
        rows={2}
        spellCheck={false}
        placeholder="Empty scene"
        className="block w-full bg-transparent text-fg-primary text-sm leading-snug px-2.5 py-2 outline-none resize-none border-none overflow-hidden placeholder:text-fg-faint"
      />
    </div>
  );
});

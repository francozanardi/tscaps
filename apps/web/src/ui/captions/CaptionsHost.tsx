import { useEffect, useMemo } from 'react';
import type { Document, Segment } from '@tscaps/engine';
import type { Sheet } from '@core/sheets/domain/Sheet';
import type { WordStyleOverrideRegistry } from '@core/editor/domain/WordStyleOverrideRegistry';
import type { SegmentOverrides } from '@core/editor/domain/SegmentOverrides';
import { SegmentTextareaFocuser } from '@presentation/editor/services/SegmentTextareaFocuser';
import { SegmentTextareaArrowNavigationController } from '@presentation/editor/controllers/SegmentTextareaArrowNavigationController';
import { CaptionsPanel } from '@ui/captions/components/CaptionsPanel';
import { useEditor } from '@ui/_shared/contexts/modules/EditorContext';
import { useSheets } from '@ui/_shared/contexts/modules/SheetsContext';
import { usePlayback } from '@ui/editor/PlaybackContext';

interface CaptionsHostProps {
  document: Document | null;
  activeSegmentId: string | null;
  sheets: Sheet[];
  activeSheetId: string | null;
  wordStyleOverrides: WordStyleOverrideRegistry;
  segmentOverrides: SegmentOverrides;
  videoDuration: number;
  isPlaying: boolean;
}

/**
 * Wires the textarea focuser and arrow-navigation controller that the
 * captions panel needs to coordinate caret behaviour across segment
 * textareas, and binds every action callback the panel consumes to the
 * editor/sheets/playback contexts.
 */
export function CaptionsHost(props: CaptionsHostProps) {
  const editor = useEditor();
  const sheets = useSheets();
  const playback = usePlayback();
  const textareaFocus = useMemo(() => new SegmentTextareaFocuser(), []);
  const textareaArrowNav = useMemo(() => new SegmentTextareaArrowNavigationController(), []);
  useEffect(() => {
    textareaArrowNav.start();
    return () => textareaArrowNav.stop();
  }, [textareaArrowNav]);

  return (
    <CaptionsPanel
      {...props}
      textareaFocus={textareaFocus}
      onSeek={playback.seek}
      onSetSegmentStyleOverride={(id, overrides) => editor.actions.segments.setStyleOverride.execute(id, overrides)}
      onDeleteWords={(ids) => editor.actions.words.delete.execute(ids)}
      onApplyStructureEdit={(doc) => editor.actions.segments.applyStructureEdit.execute(doc)}
      onInsertWord={(segIdx, lineIdx, wordIdx) => editor.actions.words.insert.execute(segIdx, lineIdx, wordIdx)}
      onInsertSegment={(segIdx, position) => editor.actions.segments.insert.execute(segIdx, position)}
      onEditWordText={(id, text) => editor.actions.words.editText.execute(id, text)}
      onEditWordTime={(id, start, end) => editor.actions.words.editTime.execute(id, start, end)}
      onEditWordTags={(id, tagNames) => editor.actions.words.editTags.execute(id, tagNames)}
      onSetWordStyleOverride={(id, overrides) => editor.actions.words.setStyleOverride.execute(id, overrides)}
      onAssignSegmentSheet={(seg: Segment, sheetId) => {
        sheets.actions.sheets.assignSegment.execute(seg, sheetId);
        playback.seek(seg.time.midpoint);
      }}
      onAutoAssignSegments={(sheetId, matcher, params) => sheets.actions.sheets.runMatcher.execute(sheetId, matcher, params)}
      onCreateSheet={(name) => sheets.actions.sheets.create.execute(name)}
      onResetSegmentLayout={(id) => editor.actions.segments.resetLayout.execute(id)}
    />
  );
}

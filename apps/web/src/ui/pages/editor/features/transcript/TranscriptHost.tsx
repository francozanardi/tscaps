import { useEffect, useMemo } from 'react';
import type { Document, Segment } from '@tscaps/engine';
import type { Sheet } from '@core/sheets/domain/Sheet';
import type { WordStyleOverrideRegistry } from '@core/captions/domain/WordStyleOverrideRegistry';
import type { SegmentOverrides } from '@core/captions/domain/SegmentOverrides';
import type { DecorationOverrideRegistry } from '@core/captions/domain/DecorationOverrideRegistry';
import { SegmentTextareaFocuser } from '@presentation/editor/services/SegmentTextareaFocuser';
import { SegmentTextareaArrowNavigationController } from '@presentation/editor/controllers/SegmentTextareaArrowNavigationController';
import { TranscriptPanel } from '@ui/pages/editor/features/transcript/components/TranscriptPanel';
import { useCaptions } from '@ui/_shared/contexts/modules/CaptionsContext';
import { useCuts } from '@ui/_shared/contexts/modules/CutsContext';
import { useSheets } from '@ui/_shared/contexts/modules/SheetsContext';
import { useEditorCuts } from '@ui/_shared/contexts/EditorStoreContext';
import { usePlayback } from '@ui/pages/editor/contexts/PlaybackContext';

interface TranscriptHostProps {
  document: Document | null;
  activeSegmentId: string | null;
  sheets: Sheet[];
  activeSheetId: string | null;
  wordStyleOverrides: WordStyleOverrideRegistry;
  segmentOverrides: SegmentOverrides;
  decorationOverrides: DecorationOverrideRegistry;
  videoDuration: number;
  isPlaying: boolean;
}

/**
 * Wires the textarea focuser and arrow-navigation controller that the
 * transcript subtab needs to coordinate caret behaviour across segment
 * textareas, and binds every action callback the panel consumes to the
 * captions / sheets / playback contexts.
 */
export function TranscriptHost(props: TranscriptHostProps) {
  const captions = useCaptions();
  const cuts = useCuts();
  const cutRegistry = useEditorCuts();
  const sheets = useSheets();
  const playback = usePlayback();
  const textareaFocus = useMemo(() => new SegmentTextareaFocuser(), []);
  const textareaArrowNav = useMemo(() => new SegmentTextareaArrowNavigationController(), []);
  useEffect(() => {
    textareaArrowNav.start();
    return () => textareaArrowNav.stop();
  }, [textareaArrowNav]);

  return (
    <TranscriptPanel
      {...props}
      cuts={cutRegistry}
      cutAwareDocumentBuilder={cuts.services.cutAwareDocumentBuilder}
      textareaFocus={textareaFocus}
      onSeek={playback.seek}
      onSetSegmentStyleOverride={(id, overrides) => captions.actions.segments.setStyleOverride.execute(id, overrides)}
      onDeleteWords={(ids) => captions.actions.words.delete.execute(ids)}
      onApplyStructureEdit={(doc) => captions.actions.segments.applyStructureEdit.execute(doc)}
      onInsertWord={(segIdx, lineIdx, wordIdx) => captions.actions.words.insert.execute(segIdx, lineIdx, wordIdx)}
      onInsertSegment={(segIdx, position) => captions.actions.segments.insert.execute(segIdx, position)}
      onEditWordText={(id, text) => captions.actions.words.editText.execute(id, text)}
      onEditWordTime={(id, start, end) => captions.actions.words.editTime.execute(id, start, end)}
      onEditWordTags={(id, tagNames) => captions.actions.words.editTags.execute(id, tagNames)}
      onSetWordStyleOverride={(id, overrides) => captions.actions.words.setStyleOverride.execute(id, overrides)}
      onAssignSegmentSheet={(seg: Segment, sheetId) => {
        sheets.actions.sheets.assignSegment.execute(seg, sheetId);
        playback.seek(seg.time.midpoint);
      }}
      onAutoAssignSegments={(sheetId, matcher, params) => sheets.actions.sheets.runMatcher.execute(sheetId, matcher, params)}
      onCreateSheet={(name) => sheets.actions.sheets.create.execute(name)}
      onResetSegmentLayout={(id) => captions.actions.segments.resetLayout.execute(id)}
    />
  );
}

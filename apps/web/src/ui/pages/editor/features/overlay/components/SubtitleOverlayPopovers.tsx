import { useMemo } from 'react';
import type { Document, Segment } from '@tscaps/engine';
import type { Sheet } from '@core/sheets/domain/Sheet';
import type { WordStyleOverrideRegistry } from '@core/captions/domain/WordStyleOverrideRegistry';
import type { SegmentOverrides } from '@core/captions/domain/SegmentOverrides';
import type { DecorationOverrideRegistry } from '@core/captions/domain/DecorationOverrideRegistry';
import type { Selection, PopoverAnchor } from '@ui/pages/editor/features/overlay/hooks/useSegmentSelection';
import { WordPopover } from '@ui/pages/editor/features/transcript/components/words/WordPopover';
import { SegmentSettingsPopover } from '@ui/pages/editor/features/transcript/components/segments/SegmentSettingsPopover';
import { EmojiPopover } from '@ui/pages/editor/features/transcript/components/decorations/EmojiPopover';
import { wordTimeBoundsInSegment } from '@ui/pages/editor/features/transcript/utils';
import { locateWord } from '@ui/pages/editor/features/overlay/locateWord';
import { useCaptions } from '@ui/_shared/contexts/modules/CaptionsContext';
import { useEngine } from '@ui/_shared/contexts/modules/EngineContext';
import { useSheets } from '@ui/_shared/contexts/modules/SheetsContext';
import { usePlayback } from '@ui/pages/editor/contexts/PlaybackContext';
import { useTranscriptCallbacks } from '@ui/pages/editor/features/transcript/hooks/useTranscriptCallbacks';
import { useWordStyleBaselineResolver } from '@ui/pages/editor/contexts/WordStyleBaselineContext';

interface SubtitleOverlayPopoversProps {
  doc: Document;
  sheets: Sheet[];
  sheetBySegmentId: ReadonlyMap<string, Sheet>;
  selection: Selection;
  popover: PopoverAnchor;
  setSelection: (s: Selection) => void;
  dismiss: () => void;
  wordStyleOverrides: WordStyleOverrideRegistry;
  segmentOverrides: SegmentOverrides;
  decorationOverrides: DecorationOverrideRegistry;
  videoDuration: number;
}

/**
 * Renders the word-level or segment-level popover driven by
 * `selection` + the right-click `popover` anchor. At most one
 * popover is mounted at any time.
 */
export function SubtitleOverlayPopovers({
  doc,
  sheets,
  sheetBySegmentId,
  selection,
  popover,
  setSelection,
  dismiss,
  wordStyleOverrides,
  segmentOverrides,
  decorationOverrides,
  videoDuration,
}: SubtitleOverlayPopoversProps) {
  const captionsModule = useCaptions();
  const { documentEditor } = useEngine();
  const sheetsModule = useSheets();
  const playback = usePlayback();
  const captions = useTranscriptCallbacks();
  const baselineResolver = useWordStyleBaselineResolver();

  const decorationContext = useMemo(() => {
    if (!popover || !selection?.wordId) return null;
    const sheet = sheetBySegmentId.get(selection.segmentId);
    if (!sheet) return null;
    const position = documentEditor.findWordByDecorationId(doc, selection.wordId);
    if (!position) return null;
    const segment = doc.getSegments()[position.segIdx]!;
    const word = segment.lines[position.lineIdx]!.words[position.wordIdx]!;
    const decoration = word.decoration;
    if (!decoration) return null;
    return { sheet, segment, word, decoration };
  }, [popover, selection, sheetBySegmentId, doc, documentEditor]);

  const decorationPopover = useMemo(() => {
    if (!decorationContext || !popover) return null;
    const { sheet, segment, decoration, word: hostWord } = decorationContext;
    const override = decorationOverrides.get(decoration.id);
    const styleOverrides = wordStyleOverrides.get(decoration.id);
    const styleBaseline = {
      ...baselineResolver.decorationTypographyBaseline(sheet, segment.id, segmentOverrides),
      ...wordStyleOverrides.get(hostWord.id),
    };
    const inheritedAlignment = baselineResolver.segmentEffectiveAlignment(sheet, segment.id, segmentOverrides);
    return (
      <EmojiPopover
        key={decoration.id}
        open
        onOpenChange={(o) => { if (!o) dismiss(); }}
        point={{ x: popover.x, y: popover.y }}
        decoration={decoration}
        inheritedAlignment={inheritedAlignment}
        styleOverrides={styleOverrides}
        styleBaseline={styleBaseline}
        onCommitGlyph={(glyph) => captionsModule.actions.decorations.setOverride.execute(decoration.id, { ...override, glyph })}
        onCommitStyleOverrides={(o) => captionsModule.actions.words.setStyleOverride.execute(decoration.id, o)}
        onDelete={() => captionsModule.actions.decorations.clear.execute(decoration.id)}
      />
    );
  }, [decorationContext, popover, decorationOverrides, wordStyleOverrides, segmentOverrides, baselineResolver, captionsModule,dismiss]);

  const wordPopover = useMemo(() => {
    if (!popover || !selection?.wordId) return null;
    if (decorationContext) return null;
    const sheet = sheetBySegmentId.get(selection.segmentId);
    if (!sheet) return null;
    const loc = locateWord(doc, selection.wordId);
    if (!loc) return null;
    const { segIdx, lineIdx, wordIdx } = loc;
    const segments = doc.getSegments();
    const segment = segments[segIdx]!;
    const line = segment.lines[lineIdx]!;
    const word = line.words[wordIdx]!;
    const isLastLine = lineIdx === segment.lines.length - 1;
    const isLastWordInLine = wordIdx === line.words.length - 1;
    const isFirstSegment = segIdx === 0;
    const isLastSegment = segIdx === segments.length - 1;
    const currentOverrides = wordStyleOverrides.get(word.id);
    const wordBounds = wordTimeBoundsInSegment(doc, segment, word.id, videoDuration);

    return (
      <WordPopover
        key={word.id}
        open
        onOpenChange={(o) => { if (!o) dismiss(); }}
        point={{ x: popover.x, y: popover.y }}
        word={word}
        isLastWordInLine={isLastWordInLine}
        sheet={sheet}
        segment={segment}
        segmentOverrides={segmentOverrides}
        currentOverrides={currentOverrides}
        prevWordEnd={wordBounds.prevEnd}
        nextWordStart={wordBounds.nextStart}
        onCommitText={(text) => captionsModule.actions.words.editText.execute(word.id, text)}
        onCommitTime={(start, end) => captionsModule.actions.words.editTime.execute(word.id, start, end)}
        onCommitTags={(names) => captionsModule.actions.words.editTags.execute(word.id, names)}
        onCommitStyleOverrides={(o) => captionsModule.actions.words.setStyleOverride.execute(word.id, o)}
        onAddLineBreakAfter={() => captionsModule.actions.segments.applyStructureEdit.execute(documentEditor.splitLineAfterWord(doc, segIdx, lineIdx, wordIdx))}
        onJoinWithNextLine={isLastWordInLine && !isLastLine
          ? () => captionsModule.actions.segments.applyStructureEdit.execute(documentEditor.mergeLineWithNext(doc, segIdx, lineIdx))
          : undefined}
        onAddWordAfter={() => {
          const newId = captionsModule.actions.words.insert.execute(segIdx, lineIdx, wordIdx);
          setSelection({ wordId: newId, segmentId: selection.segmentId });
        }}
        onMoveToPrevLine={wordIdx === 0 && lineIdx > 0
          ? () => captionsModule.actions.segments.applyStructureEdit.execute(documentEditor.moveFirstWordToPrevLine(doc, segIdx, lineIdx))
          : undefined}
        onMoveToNextLine={isLastWordInLine && !isLastLine
          ? () => captionsModule.actions.segments.applyStructureEdit.execute(documentEditor.moveLastWordToNextLine(doc, segIdx, lineIdx))
          : undefined}
        onMoveToPrevBlock={wordIdx === 0 && lineIdx === 0 && !isFirstSegment
          ? () => captionsModule.actions.segments.applyStructureEdit.execute(documentEditor.moveFirstWordToPrevSegment(doc, segIdx))
          : undefined}
        onMoveToNextBlock={isLastWordInLine && isLastLine && !isLastSegment
          ? () => captionsModule.actions.segments.applyStructureEdit.execute(documentEditor.moveLastWordToNextSegment(doc, segIdx))
          : undefined}
        onDelete={() => captionsModule.actions.words.delete.execute([word.id])}
      />
    );
  }, [popover, selection, sheetBySegmentId, doc, wordStyleOverrides, segmentOverrides, videoDuration, captionsModule,documentEditor, dismiss, setSelection, decorationContext]);

  const segmentPopover = useMemo(() => {
    if (!popover || !selection || selection.wordId !== null) return null;
    const sheet = sheetBySegmentId.get(selection.segmentId);
    if (!sheet) return null;
    const segments = doc.getSegments();
    const segIdx = segments.findIndex((s) => s.id === selection.segmentId);
    if (segIdx < 0) return null;
    const segment = segments[segIdx]!;
    const prev = segments[segIdx - 1];
    const next = segments[segIdx + 1];

    return (
      <SegmentSettingsPopover
        open
        onOpenChange={(o) => { if (!o) dismiss(); }}
        point={{ x: popover.x, y: popover.y }}
        doc={doc}
        segment={segment}
        segIdx={segIdx}
        isFirstSegment={segIdx === 0}
        isLastSegment={segIdx === segments.length - 1}
        sheet={sheet}
        sheets={sheets}
        currentOverrides={segmentOverrides.getStyle(segment.id)}
        prevSegmentEnd={prev ? prev.time.end : 0}
        nextSegmentStart={next ? next.time.start : videoDuration}
        onDeleteWords={(ids) => captionsModule.actions.words.delete.execute(ids)}
        onApplyStructureEdit={(d) => captionsModule.actions.segments.applyStructureEdit.execute(d)}
        onAssignSegmentSheet={(seg: Segment, sheetId) => {
          sheetsModule.actions.sheets.assignSegment.execute(seg, sheetId);
          playback.seek(seg.time.midpoint);
        }}
        onCreateSheet={(name) => sheetsModule.actions.sheets.create.execute(name)}
        onCommitStyleOverrides={(o) => captionsModule.actions.segments.setStyleOverride.execute(segment.id, o)}
        onCommitSegmentTime={(start, end) => captions.editSegmentTime({ segmentId: segment.id, start, end })}
        onRedistributeWords={() => captions.redistributeWords(segment.id)}
      />
    );
  }, [popover, selection, sheetBySegmentId, doc, sheets, segmentOverrides, videoDuration, captionsModule,sheetsModule, playback, captions, dismiss]);

  return (
    <>
      {decorationPopover}
      {wordPopover}
      {segmentPopover}
    </>
  );
}

import { memo, useMemo, useState } from 'react';
import { SmilePlus } from 'lucide-react';
import type { Segment, Word } from '@tscaps/engine';
import type { Sheet } from '@core/sheets/domain/Sheet';
import type { SegmentOverrides } from '@core/captions/domain/SegmentOverrides';
import type { WordStyleOverrideRegistry } from '@core/captions/domain/WordStyleOverrideRegistry';
import type { DecorationOverrideRegistry } from '@core/captions/domain/DecorationOverrideRegistry';
import { Popover } from '@ui/_shared/components/Popover/Popover';
import { usePopoverNav } from '@ui/_shared/components/Popover/usePopoverNav';
import { EmojiPopover } from '@ui/pages/editor/features/captions/components/decorations/EmojiPopover';
import { EmojiPickerScreen } from '@ui/pages/editor/features/captions/components/decorations/EmojiPickerScreen';
import { useEditor } from '@ui/_shared/contexts/modules/EditorContext';
import { useSheets } from '@ui/_shared/contexts/modules/SheetsContext';
import { useWordStyleBaselineResolver } from '@ui/pages/editor/contexts/WordStyleBaselineContext';

interface SceneDecorationsRowProps {
  segment: Segment;
  sheet: Sheet | null;
  wordStyleOverrides: WordStyleOverrideRegistry;
  segmentOverrides: SegmentOverrides;
  decorationOverrides: DecorationOverrideRegistry;
}

const TRIVIAL_WORD = /^[.,!?¿¡;:…—–\-"'`´]+$/;

function isTrivialWord(word: Word): boolean {
  const trimmed = word.text.trim();
  return !trimmed || TRIVIAL_WORD.test(trimmed);
}

function lastAnchorWordForNewDecoration(segment: Segment): Word | null {
  for (let li = segment.lines.length - 1; li >= 0; li--) {
    const line = segment.lines[li]!;
    for (let wi = line.words.length - 1; wi >= 0; wi--) {
      const word = line.words[wi]!;
      if (!isTrivialWord(word)) return word;
    }
  }
  for (let li = segment.lines.length - 1; li >= 0; li--) {
    const lastWord = segment.lines[li]!.words.at(-1);
    if (lastWord) return lastWord;
  }
  return null;
}

function decoratedWordsInSegment(segment: Segment): Word[] {
  const result: Word[] = [];
  for (const line of segment.lines) {
    for (const word of line.words) {
      if (word.decoration) result.push(word);
    }
  }
  return result;
}

const CHIP_CLASS =
  'inline-flex items-center justify-center w-6 h-6 rounded-xs bg-transparent border border-transparent cursor-pointer ' +
  'text-sm leading-none transition-colors duration-quick ease-standard ' +
  'hover:bg-surface-3 focus-visible:outline-none focus-visible:bg-surface-3';

const ADD_CHIP_CLASS =
  'inline-flex items-center justify-center w-6 h-6 rounded-xs bg-transparent border border-transparent cursor-pointer ' +
  'text-fg-faint transition-colors duration-quick ease-standard ' +
  'hover:bg-surface-3 hover:text-fg-secondary focus-visible:outline-none focus-visible:bg-surface-3 focus-visible:text-fg-secondary';

/**
 * Strip of emoji chips for a segment in the captions panel's free view.
 * One chip per decorated word — click opens the shared `EmojiPopover`
 * for edit. When the segment carries no decorations, a single dashed
 * "+" button anchors a fresh emoji onto the segment's last non-trivial
 * word. Renders nothing when the segment has no resolvable sheet — the
 * popover wiring depends on it.
 */
export const SceneDecorationsRow = memo(function SceneDecorationsRow({
  segment, sheet, wordStyleOverrides, segmentOverrides, decorationOverrides,
}: SceneDecorationsRowProps) {
  const { decorationFilter } = useSheets();
  const visibleSegment = useMemo(
    () => (sheet ? decorationFilter.filterSegment(segment, sheet, decorationOverrides) : segment),
    [decorationFilter, segment, sheet, decorationOverrides],
  );
  if (!sheet) return null;

  const decorated = decoratedWordsInSegment(visibleSegment);

  if (decorated.length === 0) {
    return <AddEmojiButton segment={segment} />;
  }

  return (
    <div className="inline-flex items-center gap-1">
      {decorated.map((word) => (
        <SceneEmojiChip
          key={word.decoration!.id}
          segment={segment}
          word={word}
          sheet={sheet}
          wordStyleOverrides={wordStyleOverrides}
          segmentOverrides={segmentOverrides}
          decorationOverrides={decorationOverrides}
        />
      ))}
    </div>
  );
});

interface SceneEmojiChipProps {
  segment: Segment;
  word: Word;
  sheet: Sheet;
  wordStyleOverrides: WordStyleOverrideRegistry;
  segmentOverrides: SegmentOverrides;
  decorationOverrides: DecorationOverrideRegistry;
}

function SceneEmojiChip({
  segment, word, sheet, wordStyleOverrides, segmentOverrides, decorationOverrides,
}: SceneEmojiChipProps) {
  const editor = useEditor();
  const baselineResolver = useWordStyleBaselineResolver();
  const [open, setOpen] = useState(false);

  const decoration = word.decoration!;

  const popoverData = useMemo(() => {
    const override = decorationOverrides.get(decoration.id);
    const styleOverrides = wordStyleOverrides.get(decoration.id);
    const styleBaseline = {
      ...baselineResolver.decorationTypographyBaseline(sheet, segment.id, segmentOverrides),
      ...wordStyleOverrides.get(word.id),
    };
    const inheritedAlignment = baselineResolver.segmentEffectiveAlignment(sheet, segment.id, segmentOverrides);
    return { override, styleOverrides, styleBaseline, inheritedAlignment };
  }, [decoration.id, word.id, sheet, segment.id, segmentOverrides, wordStyleOverrides, decorationOverrides, baselineResolver]);

  return (
    <EmojiPopover
      open={open}
      onOpenChange={setOpen}
      trigger={
        <button type="button" className={CHIP_CLASS} aria-label={`Edit emoji ${decoration.glyph}`}>
          <span>{decoration.glyph}</span>
        </button>
      }
      decoration={decoration}
      inheritedAlignment={popoverData.inheritedAlignment}
      styleOverrides={popoverData.styleOverrides}
      styleBaseline={popoverData.styleBaseline}
      onCommitGlyph={(glyph) => editor.actions.decorations.setOverride.execute(decoration.id, { ...popoverData.override, glyph })}
      onCommitStyleOverrides={(o) => editor.actions.words.setStyleOverride.execute(decoration.id, o)}
      onDelete={() => editor.actions.decorations.clear.execute(decoration.id)}
    />
  );
}

interface AddEmojiButtonProps {
  segment: Segment;
}

function AddEmojiButton({ segment }: AddEmojiButtonProps) {
  const editor = useEditor();
  const [open, setOpen] = useState(false);

  const target = lastAnchorWordForNewDecoration(segment);
  if (!target) return null;

  const handlePick = (glyph: string) => {
    editor.actions.decorations.add.execute(target.id, glyph);
    setOpen(false);
  };

  return (
    <Popover
      open={open}
      onOpenChange={setOpen}
      screens={{ picker: <PickerScreen onPick={handlePick} /> }}
      initialScreen="picker"
      triggerTooltip="Add emoji"
      trigger={
        <button type="button" className={ADD_CHIP_CLASS} aria-label="Add emoji">
          <SmilePlus size={14} />
        </button>
      }
    />
  );
}

function PickerScreen({ onPick }: { onPick: (glyph: string) => void }) {
  const { close } = usePopoverNav();
  return <EmojiPickerScreen onPick={(glyph) => { onPick(glyph); close(); }} />;
}

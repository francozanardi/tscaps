import { useMemo, useState, type ChangeEvent, type ReactElement } from 'react';
import { ArrowUp, ArrowDown, ChevronsUp, ChevronsDown, CornerDownLeft, Link2, Palette, Plus, Tags, Trash2 } from 'lucide-react';
import type { Segment, Word } from '@tscaps/engine';
import type { Sheet } from '@core/sheets/domain/Sheet';
import type { BehindActorSegmentOverrideRegistry } from '@core/person-segmentation/domain/BehindActorSegmentOverrideRegistry';
import { Popover } from '@ui/_shared/components/Popover/Popover';
import { usePopoverNav } from '@ui/_shared/components/Popover/usePopoverNav';
import { Tooltip } from '@ui/_shared/components/Tooltip/Tooltip';
import { DualRangeSlider } from '@ui/_shared/components/controls/fields/DualRangeSlider';
import { useRenderTimeMap } from '@ui/_shared/contexts/modules/CutsContext';
import { WordStyleScreen } from '@ui/pages/editor/features/transcript/components/element-style/WordStyleScreen';
import { WordTagsPanel } from '@ui/pages/editor/features/transcript/components/words/WordTagsPanel';
import { useWordTagRows, type WordTagRow } from '@ui/pages/editor/features/transcript/components/words/useWordTagRows';

// `warning`, not `danger`: nothing broke and nothing was lost — the edit
// simply did not fit, and the times it settled on are right there.
const ADJUSTED_NOTE_CLASS = 'm-0 text-3xs text-warning leading-snug';

const NO_ROOM_TOOLTIP = "No room. Adjust the neighbor word times to free up space.";

const NO_TAGS_TOOLTIP =
  "This template doesn't use tags, so tagging a word would change nothing on screen. Try another template.";

interface WordPopoverActions {
  onCommitText: (text: string) => void;
  onCommitTime: (start: number, end: number) => void;
  onCommitTags: (tagNames: ReadonlySet<string>) => void;
  onAddLineBreakAfter: () => void;
  onJoinWithNextLine?: (() => void) | undefined;
  onAddWordAfter: () => void;
  onMoveToPrevLine?: (() => void) | undefined;
  onMoveToNextLine?: (() => void) | undefined;
  onMoveToPrevBlock?: (() => void) | undefined;
  onMoveToNextBlock?: (() => void) | undefined;
  onDelete: () => void;
}

interface WordPopoverData extends WordPopoverActions {
  word: Word;
  isLastWordInLine: boolean;
  sheet: Sheet;
  segment: Segment;
  behindActorOverrides: BehindActorSegmentOverrideRegistry;
  /** Visual slider stop — previous non-empty word's end (or segment start). */
  prevWordEnd: number;
  /** Visual slider stop — next non-empty word's start (or segment end). */
  nextWordStart: number;
}

interface WordPopoverWithTrigger extends WordPopoverData {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  trigger: ReactElement;
  point?: never;
}

interface WordPopoverWithPoint extends WordPopoverData {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  point: { x: number; y: number };
  trigger?: never;
}

export type WordPopoverProps = WordPopoverWithTrigger | WordPopoverWithPoint;

const INPUT_BASE =
  'w-full box-border bg-surface-1 border border-edge-medium rounded-xs text-fg-primary outline-none ' +
  'transition-colors duration-quick ease-standard ' +
  'hover:border-edge-strong ' +
  'focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-accent/30';
const TIME_LABEL_HEAD = 'font-mono text-2xs text-fg-faint uppercase tracking-[0.06em]';
const ACTION_BTN_BASE =
  'flex items-center gap-[7px] w-full text-left text-2xs px-2 py-[5px] rounded-xs border-none bg-transparent cursor-pointer whitespace-nowrap ' +
  'transition-colors duration-quick ease-standard ' +
  'focus-visible:outline-none';
// /75 dims the semantic token so the action reads as "available but not
// shouting"; hover lifts to the full color. See `captions-classes.ts`.
const ACTION_BTN = `${ACTION_BTN_BASE} text-info/75 hover:bg-info/10 hover:text-info focus-visible:bg-info/10 focus-visible:text-info`;
const ACTION_BTN_DELETE = `${ACTION_BTN_BASE} text-danger/75 hover:bg-danger/10 hover:text-danger focus-visible:bg-danger/10 focus-visible:text-danger`;
const ACTION_BTN_DISABLED = `${ACTION_BTN_BASE} text-fg-faint cursor-not-allowed`;

/**
 * Word popover with two screens (`menu`, `styles`). Layered on top of
 * `<Popover>` for portal/positioning/dismissal/navigation; this file only
 * defines the screen content. Anchor is either a DOM element (sidebar word
 * chips, via `trigger`) or a viewport point (overlay context-menu, via
 * `point`).
 */
export function WordPopover(props: WordPopoverProps) {
  const words = useMemo(() => [props.word], [props.word]);
  const tagRows = useWordTagRows(words, props.sheet);
  const toggleTag = (tagName: string, enabled: boolean) => {
    const next = new Set<string>();
    for (const tag of props.word.semanticTags) next.add(tag.name);
    if (enabled) next.add(tagName);
    else next.delete(tagName);
    props.onCommitTags(next);
  };
  const screens = {
    menu: <WordMenuScreen {...props} tagRows={tagRows} />,
    styles: (
      <WordStyleScreen
        sheet={props.sheet}
        segment={props.segment}
        word={props.word}
      />
    ),
    tags: <WordTagsPanel rows={tagRows} onToggle={toggleTag} />,
  };

  if ('trigger' in props && props.trigger) {
    return (
      <Popover
        open={props.open}
        onOpenChange={props.onOpenChange}
        trigger={props.trigger}
        screens={screens}
        initialScreen="menu"
      />
    );
  }
  return (
    <Popover
      open={props.open}
      onOpenChange={props.onOpenChange}
      point={props.point!}
      screens={screens}
      initialScreen="menu"
    />
  );
}

type MenuScreenProps = WordPopoverData & { tagRows: ReadonlyArray<WordTagRow> };

function WordMenuScreen({
  word,
  tagRows,
  isLastWordInLine,
  prevWordEnd,
  nextWordStart,
  onCommitText,
  onCommitTime,
  onAddLineBreakAfter,
  onJoinWithNextLine,
  onAddWordAfter,
  onMoveToPrevLine,
  onMoveToNextLine,
  onMoveToPrevBlock,
  onMoveToNextBlock,
  onDelete,
}: MenuScreenProps) {
  const { navigate, close } = usePopoverNav();
  const timeMap = useRenderTimeMap();
  const outputWordStart = timeMap.toOutputTime(word.time.start);
  const outputWordEnd = timeMap.toOutputTime(word.time.end);
  const outputPrevEnd = timeMap.toOutputTime(prevWordEnd);
  const outputNextStart = timeMap.toOutputTime(nextWordStart);
  const [text, setText] = useState(word.text);
  const [start, setStart] = useState(outputWordStart.toFixed(3));
  const [end, setEnd] = useState(outputWordEnd.toFixed(3));
  const [lastText, setLastText] = useState(word.text);
  const [lastStart, setLastStart] = useState(word.time.start);
  const [lastEnd, setLastEnd] = useState(word.time.end);
  const [asked, setAsked] = useState<{ start: number; end: number } | null>(null);
  const [adjusted, setAdjusted] = useState(false);

  // Re-sync local inputs when the underlying word changes from outside
  // (undo/redo, neighbor merges). Without this the inputs would stay stale
  // while the preview and overlay reflect the new model.
  if (word.text !== lastText) {
    setLastText(word.text);
    setText(word.text);
  }
  if (word.time.start !== lastStart) {
    setLastStart(word.time.start);
    setStart(outputWordStart.toFixed(3));
  }
  if (word.time.end !== lastEnd) {
    setLastEnd(word.time.end);
    setEnd(outputWordEnd.toFixed(3));
  }

  // A committed edit is not always the edit that was asked for: a word may
  // not carry its scene over the one beside it on the same sheet, and the
  // write clamps. Re-seeding only when the stored time *changes* misses the
  // very case that needs saying — a value clamped back to where it already
  // was leaves the field showing a number that was never stored. So the
  // fields are re-seeded after every commit, whether or not anything moved.
  if (asked !== null) {
    setAdjusted(asked.start !== word.time.start || asked.end !== word.time.end);
    setAsked(null);
    setStart(outputWordStart.toFixed(3));
    setEnd(outputWordEnd.toFixed(3));
  }

  const handleTextChange = (e: ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setText(val);
    const trimmed = val.trim();
    if (trimmed && !trimmed.includes(' ')) onCommitText(trimmed);
  };

  const commitTextOnBlur = () => {
    const trimmed = text.trim();
    if (trimmed && trimmed !== word.text) onCommitText(trimmed);
  };

  // Inputs accept any finite value (overlap with neighbor words is allowed
  // as a deliberate escape hatch). Slider drags stay within neighbor bounds.
  const commitInputs = () => {
    const sOutput = parseFloat(start);
    const eOutput = parseFloat(end);
    if (!Number.isFinite(sOutput) || !Number.isFinite(eOutput) || sOutput >= eOutput) {
      setStart(timeMap.toOutputTime(word.time.start).toFixed(3));
      setEnd(timeMap.toOutputTime(word.time.end).toFixed(3));
      return;
    }
    const sSource = timeMap.toSourceTime(sOutput);
    const eSource = timeMap.toSourceTime(eOutput);
    if (sSource === word.time.start && eSource === word.time.end) return;
    setAsked({ start: sSource, end: eSource });
    onCommitTime(sSource, eSource);
  };

  const handleSliderStart = (outputValue: number) => {
    const sourceValue = timeMap.toSourceTime(outputValue);
    if (sourceValue >= word.time.end) return;
    onCommitTime(sourceValue, word.time.end);
  };

  const handleSliderEnd = (outputValue: number) => {
    const sourceValue = timeMap.toSourceTime(outputValue);
    if (sourceValue <= word.time.start) return;
    onCommitTime(word.time.start, sourceValue);
  };

  return (
    <div className="p-2 flex flex-col gap-1.5 w-[200px] box-border">
      <input
        className={`${INPUT_BASE} text-sm py-1 px-1.5`}
        dir="auto"
        value={text}
        onChange={handleTextChange}
        onBlur={commitTextOnBlur}
        onKeyDown={(e) => {
          if (e.key === 'Enter') { commitTextOnBlur(); close(); }
          if (e.key === 'Escape') close();
        }}
        autoFocus
        placeholder="Word text"
      />
      <div className="grid grid-cols-2 gap-1.5">
        <label className="flex flex-col gap-0.5">
          <span className={TIME_LABEL_HEAD}>Start</span>
          <input
            type="text" inputMode="decimal" value={start}
            className={`${INPUT_BASE} text-xs font-mono py-[3px] px-[5px]`}
            onChange={(e) => { setAdjusted(false); setStart(e.target.value); }}
            onBlur={commitInputs}
            onKeyDown={(e) => { if (e.key === 'Enter') { commitInputs(); close(); } }}
          />
        </label>
        <label className="flex flex-col gap-0.5">
          <span className={TIME_LABEL_HEAD}>End</span>
          <input
            type="text" inputMode="decimal" value={end}
            className={`${INPUT_BASE} text-xs font-mono py-[3px] px-[5px]`}
            onChange={(e) => { setAdjusted(false); setEnd(e.target.value); }}
            onBlur={commitInputs}
            onKeyDown={(e) => { if (e.key === 'Enter') { commitInputs(); close(); } }}
          />
        </label>
      </div>
      {adjusted && (
        // States the times that survived rather than naming the wall they
        // hit: the limit can be a neighbouring word, a neighbouring scene
        // on the same sheet, or the video's end.
        <p className={ADJUSTED_NOTE_CLASS}>
          Those times were not available. Kept {start}–{end}.
        </p>
      )}
      {outputPrevEnd >= outputNextStart ? (
        <Tooltip text={NO_ROOM_TOOLTIP} position="bottom">
          <div className="w-full">
            <DualRangeSlider
              min={outputPrevEnd}
              max={outputNextStart}
              step={0.01}
              startValue={outputWordStart}
              endValue={outputWordEnd}
              disabled
              onStartChange={handleSliderStart}
              onEndChange={handleSliderEnd}
            />
          </div>
        </Tooltip>
      ) : (
        <DualRangeSlider
          min={outputPrevEnd}
          max={outputNextStart}
          step={0.01}
          startValue={outputWordStart}
          endValue={outputWordEnd}
          onStartChange={handleSliderStart}
          onEndChange={handleSliderEnd}
        />
      )}
      <div className="flex flex-col gap-[3px]">
        <button className={ACTION_BTN} onClick={() => navigate('styles')}>
          <Palette size={13} /> Edit style
        </button>
        {tagRows.length > 0 ? (
          <button className={ACTION_BTN} onClick={() => navigate('tags')}>
            <Tags size={13} /> Edit tags
          </button>
        ) : (
          // Kept in place rather than dropped: the entry disappearing from
          // one scene to the next reads as a bug, the tooltip does not.
          <Tooltip text={NO_TAGS_TOOLTIP} position="right">
            <div>
              <button className={ACTION_BTN_DISABLED} disabled>
                <Tags size={13} /> Edit tags
              </button>
            </div>
          </Tooltip>
        )}
        {onMoveToPrevBlock && (
          <button className={ACTION_BTN} onClick={() => { onMoveToPrevBlock(); close(); }}>
            <ChevronsUp size={13} /> Move to previous scene
          </button>
        )}
        {onMoveToPrevLine && (
          <button className={ACTION_BTN} onClick={() => { onMoveToPrevLine(); close(); }}>
            <ArrowUp size={13} /> Move to previous line
          </button>
        )}
        {!isLastWordInLine && (
          <button className={ACTION_BTN} onClick={() => { onAddLineBreakAfter(); close(); }}>
            <CornerDownLeft size={13} /> Add line break after
          </button>
        )}
        {isLastWordInLine && onJoinWithNextLine && (
          <button className={ACTION_BTN} onClick={() => { onJoinWithNextLine(); close(); }}>
            <Link2 size={13} /> Join with next line
          </button>
        )}
        {onMoveToNextLine && (
          <button className={ACTION_BTN} onClick={() => { onMoveToNextLine(); close(); }}>
            <ArrowDown size={13} /> Move to next line
          </button>
        )}
        {onMoveToNextBlock && (
          <button className={ACTION_BTN} onClick={() => { onMoveToNextBlock(); close(); }}>
            <ChevronsDown size={13} /> Move to next scene
          </button>
        )}
        {/* No `close()` — the new word activates and a fresh popover opens for it. */}
        <button className={ACTION_BTN} onClick={() => { onAddWordAfter(); }}>
          <Plus size={13} /> Add word after
        </button>
        <button className={ACTION_BTN_DELETE} onClick={() => { onDelete(); close(); }}>
          <Trash2 size={13} /> Delete word
        </button>
      </div>
    </div>
  );
}

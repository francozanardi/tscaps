import { useCallback, useState, type ChangeEvent, type ReactElement } from 'react';
import { ArrowUp, ArrowDown, ChevronsUp, ChevronsDown, CornerDownLeft, Link2, Palette, Plus, Tags, Trash2 } from 'lucide-react';
import type { Segment, Word } from '@tscaps/engine';
import type { Sheet } from '@core/sheets/domain/Sheet';
import type { SegmentOverrides } from '@core/captions/domain/SegmentOverrides';
import type { WordStyleOverrides } from '@core/captions/domain/WordStyleOverrides';
import { Popover } from '@ui/_shared/components/Popover/Popover';
import { usePopoverNav } from '@ui/_shared/components/Popover/usePopoverNav';
import { Tooltip } from '@ui/_shared/components/Tooltip/Tooltip';
import { DualRangeSlider } from '@ui/_shared/components/controls/fields/DualRangeSlider';
import { WordStyleOverridesPanel } from '@ui/pages/editor/features/captions/components/words/WordStyleOverridesPanel';
import { WordTagsPanel } from '@ui/pages/editor/features/captions/components/words/WordTagsPanel';

const NO_ROOM_TOOLTIP = "No room. Adjust the neighbor word times to free up space.";

interface WordPopoverActions {
  onCommitText: (text: string) => void;
  onCommitTime: (start: number, end: number) => void;
  onCommitTags: (tagNames: ReadonlySet<string>) => void;
  onCommitStyleOverrides: (overrides: WordStyleOverrides) => void;
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
  segmentOverrides: SegmentOverrides;
  currentOverrides: WordStyleOverrides;
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

/**
 * Word popover with two screens (`menu`, `styles`). Layered on top of
 * `<Popover>` for portal/positioning/dismissal/navigation; this file only
 * defines the screen content. Anchor is either a DOM element (sidebar word
 * chips, via `trigger`) or a viewport point (overlay context-menu, via
 * `point`).
 */
export function WordPopover(props: WordPopoverProps) {
  const screens = {
    menu: <WordMenuScreen {...props} />,
    styles: (
      <WordStyleOverridesPanel
        sheet={props.sheet}
        segment={props.segment}
        segmentOverrides={props.segmentOverrides}
        word={props.word}
        currentOverrides={props.currentOverrides}
        onCommit={props.onCommitStyleOverrides}
      />
    ),
    tags: (
      <WordTagsPanel
        word={props.word}
        onCommit={props.onCommitTags}
      />
    ),
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

type MenuScreenProps = WordPopoverData;

function WordMenuScreen({
  word,
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
  const [text, setText] = useState(word.text);
  const [start, setStart] = useState(word.time.start.toFixed(3));
  const [end, setEnd] = useState(word.time.end.toFixed(3));
  const [lastText, setLastText] = useState(word.text);
  const [lastStart, setLastStart] = useState(word.time.start);
  const [lastEnd, setLastEnd] = useState(word.time.end);

  // Re-sync local inputs when the underlying word changes from outside
  // (undo/redo, neighbor merges). Without this the inputs would stay stale
  // while the preview and overlay reflect the new model.
  if (word.text !== lastText) {
    setLastText(word.text);
    setText(word.text);
  }
  if (word.time.start !== lastStart) {
    setLastStart(word.time.start);
    setStart(word.time.start.toFixed(3));
  }
  if (word.time.end !== lastEnd) {
    setLastEnd(word.time.end);
    setEnd(word.time.end.toFixed(3));
  }

  const handleTextChange = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setText(val);
    const trimmed = val.trim();
    if (trimmed && !trimmed.includes(' ')) onCommitText(trimmed);
  }, [onCommitText]);

  const commitTextOnBlur = useCallback(() => {
    const trimmed = text.trim();
    if (trimmed && trimmed !== word.text) onCommitText(trimmed);
  }, [text, word.text, onCommitText]);

  // Inputs accept any finite value (overlap with neighbor words is allowed
  // as a deliberate escape hatch). Slider drags stay within neighbor bounds.
  const commitInputs = useCallback(() => {
    const s = parseFloat(start);
    const e = parseFloat(end);
    if (!Number.isFinite(s) || !Number.isFinite(e) || s >= e) {
      setStart(word.time.start.toFixed(3));
      setEnd(word.time.end.toFixed(3));
      return;
    }
    if (s !== word.time.start || e !== word.time.end) onCommitTime(s, e);
  }, [start, end, word.time.start, word.time.end, onCommitTime]);

  const handleSliderStart = useCallback((v: number) => {
    if (v >= word.time.end) return;
    onCommitTime(v, word.time.end);
  }, [word.time.end, onCommitTime]);

  const handleSliderEnd = useCallback((v: number) => {
    if (v <= word.time.start) return;
    onCommitTime(word.time.start, v);
  }, [word.time.start, onCommitTime]);

  return (
    <div className="p-2 flex flex-col gap-1.5 w-[200px] box-border">
      <input
        className={`${INPUT_BASE} text-sm py-1 px-1.5`}
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
            onChange={(e) => setStart(e.target.value)}
            onBlur={commitInputs}
            onKeyDown={(e) => { if (e.key === 'Enter') { commitInputs(); close(); } }}
          />
        </label>
        <label className="flex flex-col gap-0.5">
          <span className={TIME_LABEL_HEAD}>End</span>
          <input
            type="text" inputMode="decimal" value={end}
            className={`${INPUT_BASE} text-xs font-mono py-[3px] px-[5px]`}
            onChange={(e) => setEnd(e.target.value)}
            onBlur={commitInputs}
            onKeyDown={(e) => { if (e.key === 'Enter') { commitInputs(); close(); } }}
          />
        </label>
      </div>
      {prevWordEnd >= nextWordStart ? (
        <Tooltip text={NO_ROOM_TOOLTIP} position="bottom">
          <div className="w-full">
            <DualRangeSlider
              min={prevWordEnd}
              max={nextWordStart}
              step={0.01}
              startValue={word.time.start}
              endValue={word.time.end}
              disabled
              onStartChange={handleSliderStart}
              onEndChange={handleSliderEnd}
            />
          </div>
        </Tooltip>
      ) : (
        <DualRangeSlider
          min={prevWordEnd}
          max={nextWordStart}
          step={0.01}
          startValue={word.time.start}
          endValue={word.time.end}
          onStartChange={handleSliderStart}
          onEndChange={handleSliderEnd}
        />
      )}
      <div className="flex flex-col gap-[3px]">
        <button className={ACTION_BTN} onClick={() => navigate('styles')}>
          <Palette size={13} /> Edit style
        </button>
        <button className={ACTION_BTN} onClick={() => navigate('tags')}>
          <Tags size={13} /> Edit tags
        </button>
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

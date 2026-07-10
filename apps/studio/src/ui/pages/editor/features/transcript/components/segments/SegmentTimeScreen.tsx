import { useCallback, useMemo, useState, type ChangeEvent, type KeyboardEvent } from 'react';
import { Sparkles } from 'lucide-react';
import type { RenderTimeMap, Segment } from '@tscaps/engine';
import { PopoverHeader } from '@ui/_shared/components/Popover/PopoverHeader';
import { Tooltip } from '@ui/_shared/components/Tooltip/Tooltip';
import { DualRangeSlider } from '@ui/_shared/components/controls/fields/DualRangeSlider';
import { useRenderTimeMap } from '@ui/_shared/contexts/modules/CutsContext';

const WORDS_RANGE_TOOLTIP =
  "Words keep their original times when you change the scene window.";

export interface SegmentTimeScreenProps {
  segment: Segment;
  /** Lower visual stop for the slider (immediate previous neighbor). */
  prevSegmentEnd: number;
  /** Upper visual stop for the slider (immediate next neighbor). */
  nextSegmentStart: number;
  onCommitSegmentTime: (start: number, end: number) => void;
  onRedistributeWords: () => void;
}

const TIME_INPUT_CLASS =
  'w-full px-1.5 py-0.5 rounded-xs text-2xs tabular-nums font-mono ' +
  'bg-surface-1 border border-edge-subtle text-fg-primary ' +
  'outline-none focus:border-accent';
// Slider step in seconds: 10ms is precise enough for visual drag without
// overwhelming the coalesce window; finer-than-10ms goes through the input.
const TIME_SLIDER_STEP = 0.01;
const REDISTRIBUTE_BTN =
  'inline-flex items-center gap-1 text-3xs text-fg-secondary hover:text-fg-primary ' +
  'bg-transparent border-none cursor-pointer px-1 py-0.5 rounded-xs ' +
  'transition-colors duration-quick ease-standard ' +
  'hover:bg-surface-3 focus-visible:outline-none focus-visible:bg-surface-3';

interface WordsRange {
  readonly start: number;
  readonly end: number;
}

/**
 * "Scene timing" screen of the segment popover. Two inputs accept any
 * finite value (overlap with neighbors and shrinking past internal words
 * are allowed — both are deliberate escape hatches). A dual-thumb slider
 * provides the visual control with hard stops at the neighbor bounds; a
 * dashed marker shows where the segment's words actually narrate, so the
 * user can see when they're about to hide audible words. A discreet
 * "redistribute" action rebuilds word times by pace inside the segment.
 */
export function SegmentTimeScreen({
  segment, prevSegmentEnd, nextSegmentStart, onCommitSegmentTime, onRedistributeWords,
}: SegmentTimeScreenProps) {
  const timeMap = useRenderTimeMap();
  const outputSegStart = timeMap.toOutputTime(segment.time.start);
  const outputSegEnd = timeMap.toOutputTime(segment.time.end);
  const outputPrevEnd = timeMap.toOutputTime(prevSegmentEnd);
  const outputNextStart = timeMap.toOutputTime(nextSegmentStart);
  const [startStr, setStartStr] = useState(() => outputSegStart.toFixed(3));
  const [endStr, setEndStr] = useState(() => outputSegEnd.toFixed(3));
  const [lastStart, setLastStart] = useState(segment.time.start);
  const [lastEnd, setLastEnd] = useState(segment.time.end);

  // Re-seed input strings when the segment's time changes from outside
  // (undo/redo, redistribute). Render-time sync avoids an extra effect tick.
  if (segment.time.start !== lastStart) {
    setLastStart(segment.time.start);
    setStartStr(outputSegStart.toFixed(3));
  }
  if (segment.time.end !== lastEnd) {
    setLastEnd(segment.time.end);
    setEndStr(outputSegEnd.toFixed(3));
  }

  const wordsRange = useMemo(() => findOutputWordsRange(segment, timeMap), [segment, timeMap]);

  // Neighbor bounds are the natural slider stops, but the inputs allow the
  // user to push the scene window past them. When that happens, extend the
  // axis to fit the current values so the slider and the words-range bracket
  // honestly show the overlap instead of clamping at the neighbor edge.
  const axisMin = Math.min(outputPrevEnd, outputSegStart);
  const axisMax = Math.max(outputNextStart, outputSegEnd);

  const commitInputs = useCallback(() => {
    const sOutput = parseFloat(startStr);
    const eOutput = parseFloat(endStr);
    if (!Number.isFinite(sOutput) || !Number.isFinite(eOutput) || sOutput >= eOutput) {
      setStartStr(timeMap.toOutputTime(segment.time.start).toFixed(3));
      setEndStr(timeMap.toOutputTime(segment.time.end).toFixed(3));
      return;
    }
    onCommitSegmentTime(timeMap.toSourceTime(sOutput), timeMap.toSourceTime(eOutput));
  }, [startStr, endStr, segment.time.start, segment.time.end, onCommitSegmentTime, timeMap]);

  const handleSliderStart = useCallback((outputValue: number) => {
    const sourceValue = timeMap.toSourceTime(outputValue);
    if (sourceValue >= segment.time.end) return;
    onCommitSegmentTime(sourceValue, segment.time.end);
  }, [segment.time.end, onCommitSegmentTime, timeMap]);

  const handleSliderEnd = useCallback((outputValue: number) => {
    const sourceValue = timeMap.toSourceTime(outputValue);
    if (sourceValue <= segment.time.start) return;
    onCommitSegmentTime(segment.time.start, sourceValue);
  }, [segment.time.start, onCommitSegmentTime, timeMap]);

  const handleKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') (e.currentTarget as HTMLInputElement).blur();
  };

  return (
    <div className="flex flex-col gap-2 p-2 w-[260px]">
      <PopoverHeader title="Scene timing" />
      <div className="grid grid-cols-2 gap-2">
        <label className="flex flex-col gap-1 text-2xs text-fg-secondary">
          Start
          <input
            type="text"
            inputMode="decimal"
            className={TIME_INPUT_CLASS}
            value={startStr}
            onChange={(e: ChangeEvent<HTMLInputElement>) => setStartStr(e.target.value)}
            onBlur={commitInputs}
            onKeyDown={handleKey}
          />
        </label>
        <label className="flex flex-col gap-1 text-2xs text-fg-secondary">
          End
          <input
            type="text"
            inputMode="decimal"
            className={TIME_INPUT_CLASS}
            value={endStr}
            onChange={(e: ChangeEvent<HTMLInputElement>) => setEndStr(e.target.value)}
            onBlur={commitInputs}
            onKeyDown={handleKey}
          />
        </label>
      </div>
      <DualRangeSlider
        min={axisMin}
        max={axisMax}
        step={TIME_SLIDER_STEP}
        startValue={outputSegStart}
        endValue={outputSegEnd}
        marker={wordsRange}
        onStartChange={handleSliderStart}
        onEndChange={handleSliderEnd}
      />
      {wordsRange && (
        <WordsRangeBracket
          marker={wordsRange}
          min={axisMin}
          max={axisMax}
        />
      )}
      <div className="flex items-center justify-end pt-3">
        <Tooltip
          text="Redistribute word times across the scene by speaking pace."
          position="bottom"
        >
          <button type="button" className={REDISTRIBUTE_BTN} onClick={onRedistributeWords}>
            <Sparkles size={11} />
            Redistribute
          </button>
        </Tooltip>
      </div>
    </div>
  );
}

interface WordsRangeBracketProps {
  marker: WordsRange;
  min: number;
  max: number;
}

/**
 * Bracket drawn under the slider, pointing up to the words-range marker
 * on the track. The arms anchor at the marker's edges and the horizontal
 * bar runs underneath; the label sits below the bar. Position is derived
 * from the words themselves, so the bracket stays put when the user
 * drags the segment thumbs over it.
 */
function WordsRangeBracket({ marker, min, max }: WordsRangeBracketProps) {
  const span = Math.max(0, max - min);
  if (span <= 0) return null;
  const startPct = Math.max(0, Math.min(100, ((marker.start - min) / span) * 100));
  const endPct = Math.max(0, Math.min(100, ((marker.end - min) / span) * 100));
  const widthPct = Math.max(0, endPct - startPct);
  const centerPct = (startPct + endPct) / 2;

  return (
    <Tooltip text={WORDS_RANGE_TOOLTIP} position="bottom">
      <div className="relative h-4 w-full text-fg-faint cursor-default">
        <div
          className="absolute top-0 w-[1px] h-1.5 bg-current"
          style={{ left: `${startPct}%` }}
        />
        <div
          className="absolute top-0 w-[1px] h-1.5 bg-current"
          style={{ left: `calc(${endPct}% - 1px)` }}
        />
        <div
          className="absolute top-1.5 h-[1px] bg-current"
          style={{ left: `${startPct}%`, width: `${widthPct}%` }}
        />
        <span
          className="absolute top-2 -translate-x-1/2 text-3xs whitespace-nowrap leading-none"
          style={{ left: `${centerPct}%` }}
        >
          Word times
        </span>
      </div>
    </Tooltip>
  );
}

function findOutputWordsRange(segment: Segment, timeMap: RenderTimeMap): WordsRange | null {
  let start: number | null = null;
  let end: number | null = null;
  for (const line of segment.lines) {
    for (const word of line.words) {
      if (word.text.length === 0) continue;
      if (start === null) start = word.time.start;
      end = word.time.end;
    }
  }
  if (start === null || end === null) return null;
  return { start: timeMap.toOutputTime(start), end: timeMap.toOutputTime(end) };
}

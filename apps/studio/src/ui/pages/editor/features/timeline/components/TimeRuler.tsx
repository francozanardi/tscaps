import { useMemo } from 'react';
import { TimelineRulerTicks } from '@presentation/timeline/services/TimelineRulerTicks';

const ticks = new TimelineRulerTicks();

const RULER_CLASS = 'relative overflow-hidden';

// A hairline the marks stand on, so the strip reads as one continuous
// rule rather than as a scatter of little sticks. Faint on purpose:
// what the reader is here for is the words, and a rule they notice is
// weight spent on the furniture.
const BASELINE_CLASS = 'absolute inset-x-0 bottom-0 h-px bg-edge-faint';

const MARK_CLASS = 'absolute bottom-0 w-px bg-edge-strong';
const MARK_HEIGHT_PX = 5;

const LABEL_CLASS =
  'absolute top-0 text-2xs font-mono text-fg-faint leading-none whitespace-nowrap';

interface TimeRulerProps {
  rowStartSec: number;
  rowDurationSec: number;
  heightPx: number;
}

/**
 * The strip along the top of a row, marked with the times running
 * through it.
 *
 * It is also where the row is emptiest, which is the point: the row's
 * own surface answers a press by placing the playhead or starting a
 * range, and everywhere else that surface is covered in words. Reading
 * and scrubbing want the same band, so they share it.
 *
 * A label is centred on its mark and slides aside only by however much
 * it would otherwise hang past the row.
 */
export function TimeRuler({ rowStartSec, rowDurationSec, heightPx }: TimeRulerProps) {
  const marks = useMemo(
    () => ticks.resolve(rowStartSec, rowDurationSec),
    [rowStartSec, rowDurationSec],
  );
  return (
    <div className={RULER_CLASS} style={{ height: heightPx }}>
      <div className={BASELINE_CLASS} />
      {marks.map((mark) => (
        <span key={mark.timeSec}>
          <span
            className={MARK_CLASS}
            style={{ left: `${mark.fraction * 100}%`, height: MARK_HEIGHT_PX }}
          />
          <span className={LABEL_CLASS} style={{ left: labelLeft(mark.fraction, mark.label) }}>
            {mark.label}
          </span>
        </span>
      ))}
    </div>
  );
}

/**
 * Where a label starts, as a CSS `left`, so that it reads centred on its
 * mark wherever there is room and never leaves the row where there is
 * not.
 *
 * Its width is counted in characters because the labels are monospaced,
 * which is the whole reason this can be decided without measuring
 * anything: `ch` is exactly one character wide in such a face. Deciding
 * it from a mark's **position** and not from its place in the row's list
 * is what matters — a row's first mark is usually somewhere in the
 * middle of it, with room to spare on both sides.
 */
function labelLeft(fraction: number, label: string): string {
  const widthCh = label.length;
  const centred = `calc(${fraction * 100}% - ${widthCh / 2}ch)`;
  return `clamp(0px, ${centred}, calc(100% - ${widthCh}ch))`;
}

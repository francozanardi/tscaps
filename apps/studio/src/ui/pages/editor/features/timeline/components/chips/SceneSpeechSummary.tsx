import type { TimelineSpan } from '@presentation/timeline/services/TimelineSpan';

const TITLE_CLASS = 'text-fg-primary font-medium';
const SUBTITLE_CLASS = 'text-fg-faint';
const TABLE_CLASS = 'grid grid-cols-[auto_auto] gap-x-4 gap-y-0.5 mt-1.5';
const VALUE_CLASS = 'text-right tabular-nums text-fg-primary';
const WARNING_VALUE_CLASS = 'text-right tabular-nums text-warning';

// Below a hundredth of a second the difference is rounding, not speech.
const OFF_SCREEN_THRESHOLD_SEC = 0.01;

interface SceneSpeechSummaryProps {
  /** From where the scene's first word starts to where its last one ends. */
  words: TimelineSpan;
  /** The stretch the scene is shown for. */
  window: TimelineSpan;
}

/**
 * What a dashed stretch of a scene's speech line stands for — words
 * spoken while the scene is not on screen — and the scene's numbers: how
 * long it is spoken, how long it is on screen, and how much of the speech
 * falls outside, in `warning` since it is the one figure that may call
 * for a fix.
 */
export function SceneSpeechSummary({ words, window }: SceneSpeechSummaryProps) {
  const spokenSec = words.endSec - words.startSec;
  const shownSec = window.endSec - window.startSec;
  const coveredSec = Math.max(
    0,
    Math.min(words.endSec, window.endSec) - Math.max(words.startSec, window.startSec),
  );
  const offScreenSec = spokenSec - coveredSec;
  return (
    <div>
      <div className={TITLE_CLASS}>Speech off screen</div>
      <div className={SUBTITLE_CLASS}>Words spoken while this scene is not shown</div>
      <div className={TABLE_CLASS}>
        <span>Spoken</span>
        <span className={VALUE_CLASS}>{spokenSec.toFixed(2)}s</span>
        <span>On screen</span>
        <span className={VALUE_CLASS}>{shownSec.toFixed(2)}s</span>
        {offScreenSec >= OFF_SCREEN_THRESHOLD_SEC && (
          <>
            <span>Off screen</span>
            <span className={WARNING_VALUE_CLASS}>{offScreenSec.toFixed(2)}s</span>
          </>
        )}
      </div>
    </div>
  );
}

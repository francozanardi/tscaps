import { memo } from 'react';

interface BeforeAfterTextPictureProps {
  /**
   * The text as transcribed: one caption, or several shown side by side
   * for an effect that works across them. A few characters each; long
   * text runs out of the frame.
   */
  before: string | readonly string[];
  /** The same captions once the effect has run. */
  after: string | readonly string[];
}

const WIDTH = 56;
const BEFORE_BASELINE = 15;
const AFTER_BASELINE = 32;
const CHIP_GAP = 4;
const CHIP_HEIGHT = 13;
const BEFORE_CLASS = 'fill-current text-fg-faint';
const RULE_CLASS = 'stroke-current text-edge-medium';
const CHIP_CLASS = 'fill-none stroke-current text-edge-medium';

/**
 * An effect that rewrites text, drawn as the text before it (faint) over
 * the text after it (in the card's tone), parted by a hairline. Several
 * captions on a row each sit in an outline of their own, so a reader can
 * tell where one ends — the hairline already means before and after, so
 * a second line could not also mean "next caption".
 */
export const BeforeAfterTextPicture = memo(function BeforeAfterTextPicture({ before, after }: BeforeAfterTextPictureProps) {
  const beforeCaptions = typeof before === 'string' ? [before] : before;
  const afterCaptions = typeof after === 'string' ? [after] : after;
  const captionCount = Math.max(beforeCaptions.length, afterCaptions.length);
  const slot = WIDTH / captionCount;
  const chipped = captionCount > 1;

  return (
    <svg viewBox={`0 0 ${WIDTH} 40`} className="w-full h-full">
      <line x1="6" y1="20.5" x2={WIDTH - 6} y2="20.5" className={RULE_CLASS} />
      {chipped && [BEFORE_BASELINE, AFTER_BASELINE].flatMap((baseline) => Array.from({ length: captionCount }, (_, i) => (
        <rect
          key={`${baseline}-${i}`}
          x={slot * i + CHIP_GAP / 2 + 0.5}
          y={baseline - 9.5}
          width={slot - CHIP_GAP - 1}
          height={CHIP_HEIGHT}
          rx="2"
          className={CHIP_CLASS}
        />
      )))}
      {beforeCaptions.map((caption, i) => (
        <text key={i} x={slot * (i + 0.5)} y={BEFORE_BASELINE} fontSize="10" textAnchor="middle" className={BEFORE_CLASS}>{caption}</text>
      ))}
      {afterCaptions.map((caption, i) => (
        <text key={i} x={slot * (i + 0.5)} y={AFTER_BASELINE} fontSize="10" fontWeight="600" textAnchor="middle" fill="currentColor">{caption}</text>
      ))}
    </svg>
  );
});

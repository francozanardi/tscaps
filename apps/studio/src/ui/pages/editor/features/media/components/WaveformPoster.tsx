import { memo } from 'react';

interface WaveformPosterProps {
  /** Bar heights in `[0, 1]`, first to last. */
  bars: readonly number[];
  className?: string;
}

const VIEWBOX_WIDTH = 100;
const VIEWBOX_HEIGHT = 100;
// The bars fill the middle band of the square, leaving room for the marks drawn over its corners.
const BAND_HEIGHT = 56;
const GAP_RATIO = 0.35;
// A silent stretch still draws a sliver, so the poster reads as a waveform rather than as missing.
const MIN_BAR_HEIGHT = 1.5;

/**
 * An audio file's poster: its loudness as bars mirrored about the
 * middle, in the waveform colour every waveform in the editor uses. It
 * stretches to fill its box.
 */
export const WaveformPoster = memo(function WaveformPoster({ bars, className }: WaveformPosterProps) {
  const slot = VIEWBOX_WIDTH / bars.length;
  const width = slot * (1 - GAP_RATIO);
  return (
    <svg className={className} viewBox={`0 0 ${VIEWBOX_WIDTH} ${VIEWBOX_HEIGHT}`} preserveAspectRatio="none" aria-hidden>
      {bars.map((height, index) => {
        const barHeight = Math.max(MIN_BAR_HEIGHT, height * BAND_HEIGHT);
        return (
          <rect
            key={index}
            x={index * slot + (slot - width) / 2}
            y={(VIEWBOX_HEIGHT - barHeight) / 2}
            width={width}
            height={barHeight}
            rx={width / 2}
            fill="rgb(var(--color-waveform))"
          />
        );
      })}
    </svg>
  );
});

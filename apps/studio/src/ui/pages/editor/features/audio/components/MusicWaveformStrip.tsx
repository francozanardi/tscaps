import { memo, useRef, type KeyboardEvent, type PointerEvent } from 'react';
import type { AudioTabPresenter } from '@presentation/audio-mix/services/AudioTabPresenter';
import { WaveformPoster } from '@ui/pages/editor/features/media/components/WaveformPoster';

interface MusicWaveformStripProps {
  /** The file's loudness, first to last; null until it is read. */
  bars: readonly number[] | null;
  inSec: number;
  lengthSec: number;
  presenter: AudioTabPresenter;
  onInPointChange: (inSec: number) => void;
}

const STRIP_CLASS = 'relative h-12 rounded-xs bg-surface-2 border border-edge-subtle overflow-hidden cursor-ew-resize touch-none select-none';
// What is skipped before the in-point is drawn over, so the part that plays reads as the bright one.
const SKIPPED_CLASS = 'absolute inset-y-0 left-0 bg-surface-0/60 pointer-events-none';
const HANDLE_CLASS =
  'absolute inset-y-0 w-0 border-l-2 border-accent outline-none '
  + 'focus-visible:after:absolute focus-visible:after:inset-y-0 focus-visible:after:-left-1 focus-visible:after:w-2 focus-visible:after:bg-accent/30';
const HANDLE_KNOB_CLASS = 'absolute top-0 -left-1 w-2 h-2 rounded-pill bg-accent';

/**
 * The music's whole file as a waveform, with the point it starts
 * playing from: pressed or dragged anywhere along the strip, or moved
 * with the arrow keys once focused, a tenth of a second at a time, a
 * second with Shift.
 */
export const MusicWaveformStrip = memo(function MusicWaveformStrip({ bars, inSec, lengthSec, presenter, onInPointChange }: MusicWaveformStripProps) {
  const stripRef = useRef<HTMLDivElement>(null);
  const percent = lengthSec > 0 ? (inSec / lengthSec) * 100 : 0;

  const moveTo = (clientX: number) => {
    const box = stripRef.current?.getBoundingClientRect();
    if (!box || box.width === 0) return;
    onInPointChange(presenter.inPointAt((clientX - box.left) / box.width, lengthSec));
  };
  const press = (event: PointerEvent<HTMLDivElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    moveTo(event.clientX);
  };
  const drag = (event: PointerEvent<HTMLDivElement>) => {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) moveTo(event.clientX);
  };
  const nudge = (event: KeyboardEvent<HTMLDivElement>) => {
    const direction = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0;
    if (direction === 0) return;
    event.preventDefault();
    onInPointChange(presenter.inPointNudged(inSec, direction * (event.shiftKey ? 10 : 1), lengthSec));
  };

  return (
    <div ref={stripRef} className={STRIP_CLASS} onPointerDown={press} onPointerMove={drag}>
      {bars !== null && <WaveformPoster bars={bars} className="absolute inset-0 w-full h-full" />}
      <div className={SKIPPED_CLASS} style={{ width: `${percent}%` }} />
      <div
        role="slider"
        tabIndex={0}
        aria-label="Where the music starts"
        aria-valuemin={0}
        aria-valuemax={Math.round(lengthSec * 10) / 10}
        aria-valuenow={inSec}
        aria-valuetext={presenter.inPointLabel(inSec)}
        className={HANDLE_CLASS}
        style={{ left: `${percent}%` }}
        onKeyDown={nudge}
      >
        <span className={HANDLE_KNOB_CLASS} aria-hidden />
      </div>
    </div>
  );
});

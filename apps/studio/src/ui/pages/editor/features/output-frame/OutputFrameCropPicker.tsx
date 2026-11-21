import { memo, useCallback, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import type { OutputFramePosition } from '@core/output-frame/domain/OutputFrame';

interface OutputFrameCropPickerProps {
  /** A frame of the video, as a URL; null while it is being taken. */
  poster: string | null;
  /** The video's width over its height. */
  videoAspect: number;
  /** The output frame's width over its height. */
  frameAspect: number;
  /** The one axis the frame crops the video on. */
  axis: 'x' | 'y';
  position: OutputFramePosition;
  /** Called on every step of a drag, which the caller records as one change. */
  onChange: (position: OutputFramePosition) => void;
}

const PERCENT = 100;
// The tallest the video is drawn, so a tall video never pushes the rest of the panel out of view.
const MAX_HEIGHT_PX = 200;

const FRAME_CLASS = 'relative overflow-hidden rounded-md bg-surface-3 select-none touch-none mx-auto';
const BOX_CLASS =
  'absolute rounded-xs border-2 border-accent shadow-[0_0_0_9999px_rgb(0_0_0/0.5)] cursor-move '
  + 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60';

/**
 * The whole video, as one of its frames, with the part the output frame
 * keeps outlined and the rest dimmed: dragged along the axis the frame
 * crops, to pick which part of the video shows.
 */
export const OutputFrameCropPicker = memo(function OutputFrameCropPicker({
  poster,
  videoAspect,
  frameAspect,
  axis,
  position,
  onChange,
}: OutputFrameCropPickerProps) {
  const videoRef = useRef<HTMLDivElement>(null);
  const [drag, setDrag] = useState<{ readonly pointer: number; readonly share: number } | null>(null);
  // The share of the video the frame keeps along the axis it crops, the other one kept whole.
  const kept = axis === 'x' ? frameAspect / videoAspect : videoAspect / frameAspect;
  const share = position[axis];
  const start = share * (1 - kept);

  const begin = useCallback((event: ReactPointerEvent<HTMLElement>) => {
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    setDrag({ pointer: axis === 'x' ? event.clientX : event.clientY, share });
  }, [axis, share]);

  const follow = useCallback((event: ReactPointerEvent<HTMLElement>) => {
    const box = videoRef.current?.getBoundingClientRect();
    if (drag === null || box === undefined || kept >= 1) return;
    const length = axis === 'x' ? box.width : box.height;
    if (length === 0) return;
    const travelled = ((axis === 'x' ? event.clientX : event.clientY) - drag.pointer) / length;
    const next = Math.min(1, Math.max(0, drag.share + travelled / (1 - kept)));
    onChange({ ...position, [axis]: Number(next.toFixed(4)) });
  }, [drag, kept, axis, position, onChange]);

  const finish = useCallback(() => setDrag(null), []);

  return (
    <div
      ref={videoRef}
      className={FRAME_CLASS}
      style={{ aspectRatio: `${videoAspect}`, width: '100%', maxWidth: `${MAX_HEIGHT_PX * videoAspect}px` }}
    >
      {poster !== null && (
        <img src={poster} alt="" draggable={false} className="absolute inset-0 w-full h-full object-cover pointer-events-none" />
      )}
      <div
        role="slider"
        tabIndex={0}
        aria-label={axis === 'x' ? 'Horizontal' : 'Vertical'}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(share * PERCENT)}
        className={BOX_CLASS}
        style={axis === 'x'
          ? { left: `${start * PERCENT}%`, top: 0, width: `${kept * PERCENT}%`, height: '100%' }
          : { top: `${start * PERCENT}%`, left: 0, height: `${kept * PERCENT}%`, width: '100%' }}
        onPointerDown={begin}
        onPointerMove={follow}
        onPointerUp={finish}
        onPointerCancel={finish}
        onKeyDown={(event) => {
          const step = event.key === (axis === 'x' ? 'ArrowLeft' : 'ArrowUp') ? -0.05
            : event.key === (axis === 'x' ? 'ArrowRight' : 'ArrowDown') ? 0.05 : 0;
          if (step === 0) return;
          event.preventDefault();
          onChange({ ...position, [axis]: Math.min(1, Math.max(0, Number((share + step).toFixed(4)))) });
        }}
      />
    </div>
  );
});

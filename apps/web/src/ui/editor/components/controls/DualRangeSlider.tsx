import { useCallback, useRef, type PointerEvent } from 'react';

export interface DualRangeSliderMarker {
  readonly start: number;
  readonly end: number;
}

export interface DualRangeSliderProps {
  /** Lower hard stop reachable by dragging. */
  min: number;
  /** Upper hard stop reachable by dragging. */
  max: number;
  /** Snap granularity for drag updates. */
  step: number;
  startValue: number;
  endValue: number;
  /** Optional dashed range overlaid on the track (e.g. an inner fixed region). */
  marker?: DualRangeSliderMarker | null;
  /** When true, thumbs and track are dimmed and pointer interactions ignored. */
  disabled?: boolean;
  onStartChange: (value: number) => void;
  onEndChange: (value: number) => void;
}

const THUMB_BASE =
  'absolute top-1/2 -translate-x-1/2 -translate-y-1/2 w-3 h-3 rounded-full ' +
  'bg-accent shadow-sm cursor-pointer touch-none ' +
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40';

/**
 * Two-thumb numeric slider on a shared track. The thumbs are custom DOM
 * elements driven by pointer events so the two handles never compete with
 * each other (a problem with overlapped native `input[type=range]`). The
 * optional `marker` paints a dashed band on the track — useful for
 * communicating an inner region the slider visualizes but does not change.
 */
export function DualRangeSlider({
  min, max, step, startValue, endValue, marker = null, disabled = false,
  onStartChange, onEndChange,
}: DualRangeSliderProps) {
  const trackRef = useRef<HTMLDivElement>(null);

  const pct = useCallback((v: number) => {
    if (max <= min) return 0;
    return Math.max(0, Math.min(100, ((v - min) / (max - min)) * 100));
  }, [min, max]);

  const beginDrag = useCallback((handle: 'start' | 'end') => (e: PointerEvent<HTMLButtonElement>) => {
    if (disabled) return;
    e.preventDefault();
    const track = trackRef.current;
    if (!track) return;
    const thumb = e.currentTarget;
    thumb.setPointerCapture(e.pointerId);

    const compute = (clientX: number): number => {
      const rect = track.getBoundingClientRect();
      if (rect.width <= 0) return min;
      const rel = (clientX - rect.left) / rect.width;
      const raw = min + rel * (max - min);
      const snapped = Math.round(raw / step) * step;
      return Math.max(min, Math.min(max, snapped));
    };
    const apply = (clientX: number) => {
      const v = compute(clientX);
      if (handle === 'start') onStartChange(v);
      else onEndChange(v);
    };

    const onMove = (ev: globalThis.PointerEvent) => apply(ev.clientX);
    const onUp = (ev: globalThis.PointerEvent) => {
      apply(ev.clientX);
      thumb.releasePointerCapture(ev.pointerId);
      thumb.removeEventListener('pointermove', onMove);
      thumb.removeEventListener('pointerup', onUp);
      thumb.removeEventListener('pointercancel', onUp);
    };
    thumb.addEventListener('pointermove', onMove);
    thumb.addEventListener('pointerup', onUp);
    thumb.addEventListener('pointercancel', onUp);
  }, [disabled, min, max, step, onStartChange, onEndChange]);

  const startPct = pct(startValue);
  const endPct = pct(endValue);
  const selectedLeft = Math.min(startPct, endPct);
  const selectedWidth = Math.max(0, Math.abs(endPct - startPct));

  const containerClass = disabled
    ? 'relative h-5 w-full opacity-50 cursor-not-allowed'
    : 'relative h-5 w-full';
  const thumbClass = disabled ? `${THUMB_BASE} !cursor-not-allowed` : THUMB_BASE;

  return (
    <div className={containerClass} aria-disabled={disabled || undefined}>
      <div
        ref={trackRef}
        className="absolute top-1/2 inset-x-0 -translate-y-1/2 h-[3px] bg-surface-3 rounded-full overflow-visible"
      >
        {marker && (
          <div
            className="absolute -top-[2px] h-[7px] bg-fg-faint/50 border border-dashed border-fg-faint rounded-[1px]"
            style={{
              left: `${pct(marker.start)}%`,
              width: `${Math.max(0, pct(marker.end) - pct(marker.start))}%`,
            }}
          />
        )}
        <div
          className="absolute top-0 h-[3px] bg-accent rounded-full"
          style={{ left: `${selectedLeft}%`, width: `${selectedWidth}%` }}
        />
      </div>
      <button
        type="button"
        className={thumbClass}
        disabled={disabled}
        style={{ left: `${startPct}%` }}
        onPointerDown={beginDrag('start')}
        aria-label="Range start"
      />
      <button
        type="button"
        className={thumbClass}
        disabled={disabled}
        style={{ left: `${endPct}%` }}
        onPointerDown={beginDrag('end')}
        aria-label="Range end"
      />
    </div>
  );
}

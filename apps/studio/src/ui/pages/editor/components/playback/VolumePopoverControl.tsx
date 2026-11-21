import { useEffect, useRef, useState, type ReactNode } from 'react';

interface VolumePopoverControlProps {
  /** The current level, 0 to 1. */
  volume: number;
  /** The speaker drawn for `volume`, on the button that opens the popover and on the mute toggle inside it. */
  icon: ReactNode;
  onVolumeChange: (volume: number) => void;
}

/**
 * A speaker button that opens a vertical volume slider above it, with a
 * mute toggle under the slider. It takes one button's width in the row
 * it sits in, where a horizontal slider would take sixty pixels more.
 *
 * Closes on a press anywhere outside it. Presses inside it stop at its
 * edge, so a vertical drag along the slider is not also read by a
 * surrounding surface that resizes on vertical drags.
 */
export function VolumePopoverControl({ volume, icon, onVolumeChange }: VolumePopoverControlProps) {
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [open]);

  const muteLabel = volume > 0 ? 'Mute' : 'Unmute';
  return (
    <div className="volume-popover-wrapper" ref={wrapperRef}>
      <button
        type="button"
        className="icon-btn"
        onClick={() => setOpen((wasOpen) => !wasOpen)}
        aria-label="Volume"
        aria-expanded={open}
      >
        {icon}
      </button>
      {open && (
        <div className="volume-popover" onPointerDown={(event) => event.stopPropagation()}>
          <div className="volume-popover-track">
            <input
              type="range"
              min={0} max={1} step={0.01}
              value={volume}
              onChange={(event) => onVolumeChange(parseFloat(event.target.value))}
              className="timeline-slider volume-popover-slider"
              aria-label="Volume"
              aria-orientation="vertical"
            />
          </div>
          <button type="button" className="icon-btn" onClick={() => onVolumeChange(volume > 0 ? 0 : 1)} aria-label={muteLabel}>
            {icon}
          </button>
        </div>
      )}
    </div>
  );
}

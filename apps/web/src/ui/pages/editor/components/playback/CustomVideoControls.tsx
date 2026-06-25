import '@ui/pages/editor/components/playback/CustomVideoControls.css';
import { memo, useLayoutEffect, useState, useEffect, useRef } from 'react';
import type { PlaybackTimeBinder } from '@presentation/editor/controllers/PlaybackTimeBinder';
import type { PlaybackActions } from '@ui/pages/editor/contexts/PlaybackContext';
import { Tooltip } from '@ui/_shared/components/Tooltip/Tooltip';
import { usePlayback } from '@ui/pages/editor/contexts/PlaybackContext';

interface CustomVideoControlsProps {
  playbackTimeBinder: PlaybackTimeBinder;
  isPlaying: boolean;
  volume: number;
  playbackRate: number;
  showLayoutGuide: boolean;
  showLayoutGuideToggle: boolean;
  onLayoutGuideChange: (show: boolean) => void;
}

const SPEEDS = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2] as const;
const stepSpeed = (rate: number, delta: number): number => {
  const idx = SPEEDS.indexOf(rate as typeof SPEEDS[number]);
  const next = Math.max(0, Math.min(SPEEDS.length - 1, (idx === -1 ? SPEEDS.indexOf(1) : idx) + delta));
  return SPEEDS[next] ?? 1;
};

type PlaybackStepKey = {
  [K in keyof PlaybackActions]: PlaybackActions[K] extends () => void ? K : never
}[keyof PlaybackActions];

const NAV_ROWS: { label: string; shortcut: string; prev: PlaybackStepKey; next: PlaybackStepKey }[] = [
  { label: 'Frame', shortcut: 'F + ←→', prev: 'prevFrame',   next: 'nextFrame'   },
  { label: 'Word',  shortcut: 'W + ←→', prev: 'prevWord',    next: 'nextWord'    },
  { label: 'Scene', shortcut: 'S + ←→', prev: 'prevSegment', next: 'nextSegment' },
];

const formatRate = (r: number) => r === 1 ? '1×' : `${r}×`;

// Time-driven leaves register their elements with the playback time
// binder, which writes value / textContent directly on every tick.
// React renders them once and never on a tick — the toolbar (and the
// Radix Tooltips inside it) stays insulated from playback.
const TimelineSlider = memo(function TimelineSlider({
  binder,
  onSeek,
}: { binder: PlaybackTimeBinder; onSeek: (time: number) => void }) {
  const ref = useRef<HTMLInputElement>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    return binder.bindSlider(el);
  }, [binder]);
  return (
    <input
      ref={ref}
      type="range"
      min={0}
      step={0.001}
      onChange={(e) => onSeek(binder.sourceTimeForOutput(parseFloat(e.target.value)))}
      className="timeline-slider"
    />
  );
});

const TimeDisplay = memo(function TimeDisplay({ binder }: { binder: PlaybackTimeBinder }) {
  const ref = useRef<HTMLSpanElement>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    return binder.bindTimeDisplay(el);
  }, [binder]);
  return <span ref={ref} className="time-display" />;
});

export const CustomVideoControls = memo(function CustomVideoControls({
  playbackTimeBinder,
  isPlaying,
  volume,
  playbackRate,
  showLayoutGuide,
  showLayoutGuideToggle,
  onLayoutGuideChange,
}: CustomVideoControlsProps) {
  const playback = usePlayback();

  const [gearOpen, setGearOpen] = useState(false);
  const gearRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!gearOpen) return;
    const onPointerDown = (e: PointerEvent) => {
      if (gearRef.current && !gearRef.current.contains(e.target as Node)) {
        setGearOpen(false);
      }
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [gearOpen]);

  return (
    <div className="custom-video-controls">
      <div className="custom-video-controls-timeline">
        <TimelineSlider binder={playbackTimeBinder} onSeek={playback.seek} />
      </div>
      <div className="custom-video-controls-actions">
        <Tooltip text={isPlaying ? 'Pause' : 'Play'} position="top">
          <button className="icon-btn play-btn" onClick={playback.togglePlay}>
            {isPlaying ? (
              <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>
            ) : (
              <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20"><path d="M8 5v14l11-7z"/></svg>
            )}
          </button>
        </Tooltip>

        <div className="volume-control">
          <Tooltip text={volume > 0 ? 'Mute' : 'Unmute'} position="top">
            <button className="icon-btn" onClick={() => playback.setVolume(volume > 0 ? 0 : 1)}>
              {volume > 0 ? (
                <svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/></svg>
              ) : (
                <svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18"><path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z"/></svg>
              )}
            </button>
          </Tooltip>
          <input
            type="range"
            min={0} max={1} step={0.01}
            value={volume}
            onChange={(e) => playback.setVolume(parseFloat(e.target.value))}
            className="timeline-slider volume-slider"
          />
        </div>

        <TimeDisplay binder={playbackTimeBinder} />

        <div className="gear-wrapper" ref={gearRef}>
          {playbackRate !== 1 && (
            <span className="speed-badge">{formatRate(playbackRate)}</span>
          )}
          <Tooltip text="More options" position="top">
            <button className="icon-btn gear-btn" onClick={() => setGearOpen(o => !o)}>
              <svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18">
                <path d="M19.14 12.94c.04-.3.06-.61.06-.94s-.02-.64-.07-.94l2.03-1.58a.49.49 0 0 0 .12-.61l-1.92-3.32a.49.49 0 0 0-.59-.22l-2.39.96a7.02 7.02 0 0 0-1.62-.94l-.36-2.54A.484.484 0 0 0 14 2h-4c-.25 0-.46.18-.49.42l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96a.48.48 0 0 0-.59.22L2.63 8.48a.48.48 0 0 0 .12.61l2.03 1.58c-.05.3-.09.63-.09.94s.02.64.07.94l-2.03 1.58a.49.49 0 0 0-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.37 1.04.7 1.62.94l.36 2.54c.05.24.26.42.49.42h4c.25 0 .46-.18.49-.42l.36-2.54c.59-.24 1.13-.57 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32a.47.47 0 0 0-.12-.61l-2.01-1.58zM12 15.6a3.6 3.6 0 1 1 0-7.2 3.6 3.6 0 0 1 0 7.2z"/>
              </svg>
            </button>
          </Tooltip>

          {gearOpen && (
            <div className="gear-popup">
              <div className="gear-popup-section">
                <div className="gear-popup-label">Speed <span className="gear-popup-hint">, slower · . faster</span></div>
                <div className="speed-carousel">
                  <button
                    className="speed-carousel-btn"
                    disabled={playbackRate <= SPEEDS[0]!}
                    onClick={() => playback.setPlaybackRate(stepSpeed(playbackRate, -1))}
                  >
                    <svg viewBox="0 0 24 24" fill="currentColor" width="14" height="14"><path d="M15.41 16.59L10.83 12l4.58-4.59L14 6l-6 6 6 6 1.41-1.41z"/></svg>
                  </button>
                  <span className="speed-carousel-value">{formatRate(playbackRate)}</span>
                  <button
                    className="speed-carousel-btn"
                    disabled={playbackRate >= SPEEDS[SPEEDS.length - 1]!}
                    onClick={() => playback.setPlaybackRate(stepSpeed(playbackRate, 1))}
                  >
                    <svg viewBox="0 0 24 24" fill="currentColor" width="14" height="14"><path d="M8.59 16.59L13.17 12 8.59 7.41 10 6l6 6-6 6-1.41-1.41z"/></svg>
                  </button>
                </div>
              </div>
              <div className="gear-popup-section">
                <div className="gear-popup-label">Navigate</div>
                {NAV_ROWS.map(({ label, shortcut, prev, next }) => (
                  <div key={label} className="nav-row">
                    <button className="nav-step-btn" onClick={playback[prev]}>
                      <svg viewBox="0 0 24 24" fill="currentColor" width="14" height="14"><path d="M15.41 16.59L10.83 12l4.58-4.59L14 6l-6 6 6 6 1.41-1.41z"/></svg>
                    </button>
                    <span className="nav-row-label">{label}</span>
                    <button className="nav-step-btn" onClick={playback[next]}>
                      <svg viewBox="0 0 24 24" fill="currentColor" width="14" height="14"><path d="M8.59 16.59L13.17 12 8.59 7.41 10 6l6 6-6 6-1.41-1.41z"/></svg>
                    </button>
                    <span className="nav-shortcut">{shortcut}</span>
                  </div>
                ))}
              </div>
              {showLayoutGuideToggle && (
                <div className="gear-popup-section">
                  <div className="gear-popup-label">
                    Layout guide
                    <span className="gear-popup-hint">view-only</span>
                  </div>
                  <button
                    className={`layout-guide-toggle${showLayoutGuide ? ' layout-guide-toggle--active' : ''}`}
                    onClick={() => onLayoutGuideChange(!showLayoutGuide)}
                  >
                    {showLayoutGuide ? 'On' : 'Off'}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
});

import { memo, useEffect, useRef } from 'react';
import type { GraphicPreset } from '@core/graphics/domain/GraphicPreset';
import type { GraphicFilmstrip } from '@core/graphics/services/GraphicFilmstripRecorder';
import { useGraphicPresetThumbnail } from '@ui/pages/editor/features/graphics/hooks/useGraphicPresetThumbnail';

// The still a card rests on, and the one shown to whoever asked for less motion: past every preset's entrance.
const STILL_FRAME_SEC = 1.2;
const REDUCED_MOTION = '(prefers-reduced-motion: reduce)';

// A muted stand-in for a video behind the graphic, so white text and transparent parts read. It takes no pointer:
// what it shows changes as a thumbnail lands, and a press that started on one picture and ended on another would
// otherwise be no click on the card at all.
const AREA_CLASS =
  'relative w-full aspect-[32/15] rounded-xs overflow-hidden pointer-events-none '
  + 'bg-[linear-gradient(135deg,#3d4f6b,#6b5a4f)]';

interface GraphicPresetThumbnailViewProps {
  preset: GraphicPreset;
  /** Whether it plays, as while the card is hovered; a still otherwise. */
  playing: boolean;
}

/**
 * A preset at its own shape over a stand-in for the video: a still at
 * rest, its first seconds in a loop while `playing`, recorded once. A
 * pulse while it is being recorded; nothing over the stand-in where it
 * could not be.
 */
export const GraphicPresetThumbnailView = memo(function GraphicPresetThumbnailView({ preset, playing }: GraphicPresetThumbnailViewProps) {
  const thumbnail = useGraphicPresetThumbnail(preset);
  return (
    <div className={AREA_CLASS} aria-hidden>
      {thumbnail.kind === 'ready' && <FilmstripLoop filmstrip={thumbnail.filmstrip} playing={playing} />}
      {thumbnail.kind === 'waiting' && <div className="absolute inset-0 animate-pulse bg-white/10" />}
    </div>
  );
});

function FilmstripLoop({ filmstrip, playing }: { filmstrip: GraphicFilmstrip; playing: boolean }) {
  const canvas = useRef<HTMLCanvasElement | null>(null);
  useEffect(() => {
    const context = canvas.current?.getContext('2d');
    const { frames, frameSec } = filmstrip;
    if (!context || frames.length === 0) return undefined;
    let shown = -1;
    const show = (index: number) => {
      const frame = frames[index]!;
      // A released thumbnail's frames are closed at once, and a closed bitmap reads 0 wide and throws when drawn.
      // The store tells its readers right after, but a card rendered before that can still get here first; it keeps
      // the picture it has until it reads the store again and asks for a fresh one.
      if (index === shown || frame.width === 0) return;
      shown = index;
      context.clearRect(0, 0, context.canvas.width, context.canvas.height);
      context.drawImage(frame, 0, 0);
    };
    if (!playing || window.matchMedia(REDUCED_MOTION).matches) {
      show(Math.min(frames.length - 1, Math.round(STILL_FRAME_SEC / frameSec)));
      return undefined;
    }
    const startedMs = performance.now();
    let request = 0;
    const tick = (nowMs: number) => {
      show(Math.floor((nowMs - startedMs) / 1000 / frameSec) % frames.length);
      request = requestAnimationFrame(tick);
    };
    request = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(request);
  }, [filmstrip, playing]);
  const first = filmstrip.frames[0];
  return (
    <canvas
      ref={canvas}
      width={first?.width ?? 1}
      height={first?.height ?? 1}
      className="absolute inset-[8%] w-[84%] h-[84%] object-contain"
    />
  );
}

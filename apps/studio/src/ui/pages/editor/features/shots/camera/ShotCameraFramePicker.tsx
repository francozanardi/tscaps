import { memo, useCallback, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import type { ShotCameraEnd, ShotCameraPoint } from '@core/shots/actions/SetShotCameraAction';
import { ShotVideoFraming } from '@core/shots/domain/ShotVideoFraming';
import {
  ShotCameraFrameGeometry,
  type ShotCameraFramePoint,
  type ShotCameraFrameRect,
  type ShotCameraFrameSpan,
} from '@presentation/shots/services/ShotCameraFrameGeometry';
import { FrameReadingMark } from '@ui/pages/editor/features/shots/components/FrameReadingMark';

interface ShotCameraFramePickerProps {
  /** A frame of the shot, as a URL; null while it is being taken. */
  poster: string | null;
  /** A newer frame is being read for the poster. */
  posterReading: boolean;
  /** The picture's width over its height: the whole video where a filled frame crops it, the frame otherwise. */
  pictureAspect: number;
  /** How many frames of video the picture spans along each axis (`ShotCameraFrameGeometry`). */
  span: ShotCameraFrameSpan;
  /**
   * How the poster sits in the picture: covering it, or whole inside it
   * (a fitted frame) over black or over itself blurred, as the frame's
   * backdrop is.
   */
  posterFit: 'cover' | 'contain-black' | 'contain-blur';
  /** Where the frame crops the video, each axis a share of what it crops away. */
  frameShare: ShotCameraFramePoint;
  start: ShotVideoFraming;
  /** Where the camera moves to; null for a camera that holds its start. */
  end: ShotVideoFraming | null;
  /**
   * Where an effect closes in, for a camera whose framings hold the whole
   * frame: then only this point is shown. Null where there is none.
   */
  anchor: ShotCameraPoint | null;
  /** Whether a box can be taken closer by its corner; false where only a camera could, and none is picked. */
  zoomable: boolean;
  /** Called on every step of a drag, which the caller records as one change. */
  onFraming: (end: ShotCameraEnd, framing: ShotVideoFraming) => void;
  onAnchor: (point: ShotCameraPoint) => void;
  /**
   * A box, or the point, was taken hold of or picked: the frame showing
   * it can be put on screen, to watch it change while it is dragged
   * (`'anchor'` for the point).
   */
  onShow: (what: ShotCameraEnd | 'anchor') => void;
}

interface Drag {
  readonly kind: 'move' | 'resize' | 'anchor';
  readonly end: ShotCameraEnd;
  readonly pointerX: number;
  readonly pointerY: number;
  readonly centre: ShotCameraFramePoint;
  /** One over the box's scale when it was taken hold of. */
  readonly inverseScale: number;
}

const GEOMETRY = new ShotCameraFrameGeometry();
const PERCENT = 100;
// The tallest the frame is drawn, so a tall output (9:16) never pushes the rest of the panel out of view.
const MAX_HEIGHT_PX = 200;
const DOT_PX = 16;
// How far into the frame a box's far corner must sit for its handle to stay whole there.
const EDGE = 0.97;

const FRAME_CLASS = 'relative overflow-hidden rounded-md bg-surface-3 select-none touch-none mx-auto';
const BOX_CLASS =
  'absolute rounded-xs border-2 transition-[border-color,background-color] duration-quick ease-standard '
  + 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60';
const SELECTED_BOX_CLASS = 'z-10 border-accent shadow-[0_0_0_9999px_rgb(0_0_0/0.5)]';
// The other box only shows where it is: it is picked from its tag, never by a press on it.
const IDLE_BOX_CLASS = 'pointer-events-none border-white/60 border-dashed';
const HINTED_BOX_CLASS = 'pointer-events-none border-white bg-white/20';
const TAG_CLASS =
  'absolute z-20 px-1.5 py-0.5 font-mono text-3xs uppercase tracking-[0.06em] leading-none rounded-xs border-none cursor-pointer '
  + 'transition-colors duration-quick ease-standard focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60';
const SELECTED_TAG_CLASS = 'bg-accent text-white';
const IDLE_TAG_CLASS = 'bg-white/80 text-black hover:bg-white hover:ring-2 hover:ring-white/70';
const HANDLE_CLASS =
  // On the corner itself, above every box, so the picked one's corner is reached even where the other covers it.
  'absolute z-30 right-0 bottom-0 w-3.5 h-3.5 rounded-full bg-accent border-2 border-white cursor-nwse-resize';
// Centred on the vertex, unless the box reaches the frame's edge there, where half of it would be cut off.
const ON_VERTEX_CLASS = 'translate-x-1/2 translate-y-1/2';
const DOT_CLASS =
  'absolute z-20 rounded-full border-2 border-white bg-accent cursor-move -translate-x-1/2 -translate-y-1/2 '
  + 'shadow-[0_0_0_3px_rgb(0_0_0/0.35)] hover:scale-110 transition-transform duration-quick';

/**
 * A frame of the shot — the whole video where a filled output frame
 * crops it, since a shot's camera can look at any of it along that
 * axis; the frame as composed otherwise — with the part the camera keeps
 * in view at the start of the shot and, for a camera that moves, at the
 * end, each a box drawn where the stage puts it.
 *
 * One box is the one being worked on: lit, on top, the rest of the
 * frame dimmed around it; dragged from inside to move it (when held
 * closer than the frame) and by its corner to go closer. It starts as
 * the closest one. The other is picked only from its tag, which sits
 * above both boxes and lights its box up while the pointer rests on it;
 * a press on the box itself does nothing.
 *
 * For a camera that holds the whole frame under an effect, only a point
 * shows, where the effect closes in; it never leaves the frame.
 */
export const ShotCameraFramePicker = memo(function ShotCameraFramePicker({
  poster,
  posterReading,
  pictureAspect,
  span,
  posterFit,
  frameShare,
  start,
  end,
  anchor,
  zoomable,
  onFraming,
  onAnchor,
  onShow,
}: ShotCameraFramePickerProps) {
  const frameRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<Drag | null>(null);
  const closest: ShotCameraEnd = end !== null && end.scale > start.scale ? 'end' : 'start';
  // Which box is worked on is a view of the picker; it falls back to the closest where its box is gone.
  const [picked, setPicked] = useState<ShotCameraEnd | null>(null);
  // The box whose tag the pointer rests on, lit to say which one the tag picks.
  const [hinted, setHinted] = useState<ShotCameraEnd | null>(null);
  const selected: ShotCameraEnd = picked === 'end' && end === null ? 'start' : picked ?? closest;
  const framings: Array<[ShotCameraEnd, ShotVideoFraming]> = [['start', start]];
  if (end !== null) framings.push(['end', end]);


  const begin = useCallback((kind: Drag['kind'], which: ShotCameraEnd, centre: ShotCameraFramePoint, inverseScale = 1) => (
    (event: ReactPointerEvent<HTMLElement>) => {
      event.preventDefault();
      event.stopPropagation();
      setPicked(which);
      onShow(kind === 'anchor' ? 'anchor' : which);
      event.currentTarget.setPointerCapture(event.pointerId);
      dragRef.current = { kind, end: which, pointerX: event.clientX, pointerY: event.clientY, centre, inverseScale };
    }
  ), [onShow]);

  const follow = useCallback((event: ReactPointerEvent<HTMLElement>) => {
    const drag = dragRef.current;
    const box = frameRef.current?.getBoundingClientRect();
    if (drag === null || box === undefined || box.width === 0 || box.height === 0) return;
    const moved = {
      x: Math.min(1, Math.max(0, drag.centre.x + (event.clientX - drag.pointerX) / box.width)),
      y: Math.min(1, Math.max(0, drag.centre.y + (event.clientY - drag.pointerY) / box.height)),
    };
    if (drag.kind === 'anchor') {
      // The point is a share of the frame, which the start box is on the picture.
      const window = GEOMETRY.rectOf(start, frameShare, span);
      onAnchor({
        x: Math.min(1, Math.max(0, (moved.x - window.left) / window.width)),
        y: Math.min(1, Math.max(0, (moved.y - window.top) / window.height)),
      });
      return;
    }
    const framing = drag.end === 'end' && end !== null ? end : start;
    if (drag.kind === 'move') {
      if (GEOMETRY.canMove(framing, span)) onFraming(drag.end, GEOMETRY.centredAt(framing, moved, span));
      return;
    }
    // Relative to where the corner was taken: the view keeps its centre, so the corner travelling d
    // along an axis grows the view's side there by 2d, which is 2d × span on one over the scale.
    const travelledX = (event.clientX - drag.pointerX) / box.width;
    const travelledY = (event.clientY - drag.pointerY) / box.height;
    const inverse = drag.inverseScale + (2 * travelledX * span.x + 2 * travelledY * span.y) / 2;
    const [minScale, maxScale] = ShotVideoFraming.rangeOf('scale');
    const scale = Math.min(maxScale, Math.max(minScale, 1 / Math.max(inverse, 1 / maxScale)));
    onFraming(drag.end, GEOMETRY.scaledTo(framing, Number(scale.toFixed(3)), frameShare, span));
  }, [start, end, frameShare, span, onFraming, onAnchor]);

  const finish = useCallback(() => {
    dragRef.current = null;
  }, []);

  const dragHandlers = { onPointerMove: follow, onPointerUp: finish, onPointerCancel: finish };
  // Where a part of the frame sits inside the picture, as CSS.
  const placed = (part: ShotCameraFrameRect) => ({
    left: `${part.left * PERCENT}%`,
    top: `${part.top * PERCENT}%`,
    width: `${part.width * PERCENT}%`,
    height: `${part.height * PERCENT}%`,
  });
  // A point placed inside the frame, kept a dot's half from its edges so it never slips out of view.
  const inside = (share: number) => `clamp(${DOT_PX / 2}px, ${share * PERCENT}%, calc(100% - ${DOT_PX / 2}px))`;
  // The frame on the picture, which the effect's point is a share of.
  const anchorWindow = anchor === null ? null : GEOMETRY.rectOf(start, frameShare, span);
  const labelOf = (which: ShotCameraEnd) => (end === null ? 'Framing' : which === 'end' ? 'End' : 'Start');

  return (
    <div
      ref={frameRef}
      className={FRAME_CLASS}
      style={{ aspectRatio: `${pictureAspect}`, width: '100%', maxWidth: `${MAX_HEIGHT_PX * pictureAspect}px` }}
    >
      {poster !== null && posterFit === 'contain-blur' && (
        <img src={poster} alt="" draggable={false} className="absolute inset-0 w-full h-full object-cover blur-md scale-110 pointer-events-none" />
      )}
      {poster !== null && (
        <img
          src={poster}
          alt=""
          draggable={false}
          className={`absolute inset-0 w-full h-full pointer-events-none ${
            posterFit === 'cover' ? 'object-cover' : posterFit === 'contain-black' ? 'object-contain bg-black' : 'object-contain'}`}
        />
      )}
      {posterReading && <FrameReadingMark />}
      {anchor === null && framings.map(([which, framing]) => {
        const rect = GEOMETRY.rectOf(framing, frameShare, span);
        const centre = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
        const isSelected = which === selected;
        const movable = GEOMETRY.canMove(framing, span);
        return (
          <div
            key={which}
            role="slider"
            tabIndex={isSelected ? 0 : -1}
            aria-label={labelOf(which)}
            aria-valuemin={100}
            aria-valuemax={300}
            aria-valuenow={Math.round(framing.scale * PERCENT)}
            aria-current={isSelected}
            className={`${BOX_CLASS} ${isSelected ? SELECTED_BOX_CLASS : hinted === which ? HINTED_BOX_CLASS : IDLE_BOX_CLASS} ${
              isSelected && movable ? 'cursor-move' : ''}`}
            style={placed(rect)}
            onPointerDown={isSelected ? begin('move', which, centre) : undefined}
            {...(isSelected ? dragHandlers : {})}
          >
            {isSelected && zoomable && (
              <span
                className={`${HANDLE_CLASS} ${rect.left + rect.width < EDGE && rect.top + rect.height < EDGE ? ON_VERTEX_CLASS : ''}`}
                onPointerDown={begin('resize', which, centre, 1 / framing.scale)}
                {...dragHandlers}
              />
            )}
          </div>
        );
      })}
      {anchor === null && end !== null && framings.map(([which, framing]) => {
        const rect = GEOMETRY.rectOf(framing, frameShare, span);
        // Opposite corners, so the two tags never cover each other where the boxes share an edge.
        const corner = which === 'end'
          ? { left: `calc(${(rect.left + rect.width) * PERCENT}% - 2px)`, top: `calc(${rect.top * PERCENT}% + 2px)`, transform: 'translateX(-100%)' }
          : { left: `calc(${rect.left * PERCENT}% + 2px)`, top: `calc(${rect.top * PERCENT}% + 2px)` };
        // The only way to pick a box: its tag, which lights the box up while the pointer rests on it.
        return (
          <button
            key={`${which}-tag`}
            type="button"
            className={`${TAG_CLASS} ${which === selected ? SELECTED_TAG_CLASS : IDLE_TAG_CLASS}`}
            style={corner}
            aria-pressed={which === selected}
            onClick={() => {
              setPicked(which);
              onShow(which);
            }}
            onPointerEnter={() => setHinted(which)}
            onPointerLeave={() => setHinted((current) => (current === which ? null : current))}
          >
            {labelOf(which)}
          </button>
        );
      })}
      {anchor !== null && anchorWindow !== null && (
        <span
          role="slider"
          tabIndex={0}
          aria-label="Zooms towards"
          aria-valuenow={Math.round(anchor.x * PERCENT)}
          className={DOT_CLASS}
          style={{
            left: inside(anchorWindow.left + anchor.x * anchorWindow.width),
            top: inside(anchorWindow.top + anchor.y * anchorWindow.height),
            width: DOT_PX,
            height: DOT_PX,
          }}
          onPointerDown={begin('anchor', 'start', {
            x: anchorWindow.left + anchor.x * anchorWindow.width,
            y: anchorWindow.top + anchor.y * anchorWindow.height,
          })}
          {...dragHandlers}
        />
      )}
    </div>
  );
});

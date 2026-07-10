import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react';
import { BottomSheetResizeController } from '@presentation/editor/controllers/BottomSheetResizeController';
import { useObservedHeightPx } from '@ui/_shared/hooks/useObservedHeightPx';

interface MobileEditorLayoutProps {
  videoBox: ReactNode;
  playbackControls: ReactNode;
  sidebar: ReactNode;
  videoAspectRatio: number | null;
}

interface RectSize {
  readonly widthPx: number;
  readonly heightPx: number;
}

const VIDEO_ZONE_GAP_PX = 8;

interface ResizeSnapshot {
  readonly pct: number;
  readonly isDragging: boolean;
}

function useResizeSnapshot(controller: BottomSheetResizeController): ResizeSnapshot {
  const [snapshot, setSnapshot] = useState<ResizeSnapshot>(() => ({
    pct: controller.pct,
    isDragging: controller.isDragging,
  }));
  useEffect(() => {
    const update = () => setSnapshot({ pct: controller.pct, isDragging: controller.isDragging });
    controller.addEventListener('change', update);
    update();
    return () => controller.removeEventListener('change', update);
  }, [controller]);
  return snapshot;
}

function useObservedRect(elementRef: React.RefObject<HTMLElement | null>): RectSize {
  const [rect, setRect] = useState<RectSize>({ widthPx: 0, heightPx: 0 });
  useEffect(() => {
    const el = elementRef.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      setRect({ widthPx: entry.contentRect.width, heightPx: entry.contentRect.height });
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [elementRef]);
  return rect;
}

/**
 * Mobile editor layout. Video region fills the area above a pull-up bottom
 * sheet that hosts the sidebar. Two zones drive the split: the small
 * handle on top of the sheet (primary affordance) and the entire video
 * region above it (largest target — drag anywhere over the video or
 * the playback bar). On the video region the resize commits only after
 * a touch gesture turns out to be vertical, so taps on buttons and
 * horizontal slider scrubs keep working. Default rests at the
 * controller's minimum so the video gets the most room unless the user
 * actively expands the editor.
 */
export function MobileEditorLayout({ videoBox, playbackControls, sidebar, videoAspectRatio }: MobileEditorLayoutProps) {
  const controller = useMemo(() => new BottomSheetResizeController(), []);
  const { pct, isDragging } = useResizeSnapshot(controller);
  const containerRef = useRef<HTMLDivElement>(null);
  const playbackControlsRef = useRef<HTMLDivElement>(null);
  const playbackControlsHeightPx = useObservedHeightPx(playbackControlsRef);
  const containerRect = useObservedRect(containerRef);

  // Sidebar can't shrink below the point where the video already fills
  // the column width — any smaller and the video zone just grows the
  // empty space below the controls.
  useEffect(() => {
    if (!videoAspectRatio || containerRect.heightPx === 0 || containerRect.widthPx === 0) return;
    const videoMaxHeightPx = containerRect.widthPx / videoAspectRatio;
    const videoZoneHeightPx = videoMaxHeightPx + playbackControlsHeightPx + VIDEO_ZONE_GAP_PX;
    const floor = 1 - videoZoneHeightPx / containerRect.heightPx;
    controller.setMinPctFloor(floor);
  }, [controller, videoAspectRatio, containerRect.widthPx, containerRect.heightPx, playbackControlsHeightPx]);

  const measuredContainerHeight = (): number =>
    containerRef.current?.getBoundingClientRect().height ?? 0;

  const onHandlePointerDown = (e: ReactPointerEvent<HTMLElement>) => {
    controller.startHandleDrag(e.clientY, measuredContainerHeight());
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const onHandlePointerMove = (e: ReactPointerEvent<HTMLElement>) => {
    controller.extendHandleDrag(e.clientY);
  };

  const onHandlePointerUp = (e: ReactPointerEvent<HTMLElement>) => {
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
    controller.endDrag();
  };

  const onVideoZonePointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.pointerType !== 'touch') return;
    controller.startZoneTouchGesture(e.pointerId, e.clientX, e.clientY, measuredContainerHeight());
  };

  const onVideoZonePointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const justCommitted = controller.extendZoneTouchGesture(e.pointerId, e.clientX, e.clientY);
    if (justCommitted) {
      e.currentTarget.setPointerCapture(e.pointerId);
    }
  };

  const onVideoZonePointerUp = (e: ReactPointerEvent<HTMLDivElement>) => {
    controller.endZoneTouchGesture(e.pointerId);
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
  };

  return (
    <div ref={containerRef} className="relative w-full flex-1 min-h-0">
      {/* Video region doubles as the primary resize surface — a vertical
          touch drag anywhere here resizes the sheet. Child controls
          (playback buttons, slider) keep working because the resize
          commits only after the gesture is decided as vertical. */}
      <div
        className="absolute inset-x-0 top-0 flex flex-col items-center gap-2 px-1 touch-none [container-type:size]"
        style={{
          bottom: `${pct * 100}%`,
          ['--playback-controls-h' as string]: `${playbackControlsHeightPx}px`,
        }}
        onPointerDown={onVideoZonePointerDown}
        onPointerMove={onVideoZonePointerMove}
        onPointerUp={onVideoZonePointerUp}
        onPointerCancel={onVideoZonePointerUp}
      >
        {videoBox}
        <div ref={playbackControlsRef} className="w-full flex flex-col items-center">
          {playbackControls}
        </div>
      </div>
      {/* `select-none` keeps the OS from offering text-selection handles
          while the user drags. */}
      <div
        className="absolute inset-x-0 bottom-0 flex flex-col bg-surface-1 border-t border-edge-medium rounded-t-xl shadow-md select-none"
        style={{
          height: `${pct * 100}%`,
          transition: isDragging ? 'none' : 'height 200ms ease-out',
        }}
      >
        <div
          className="flex items-center justify-center py-2 cursor-row-resize touch-none shrink-0"
          onPointerDown={onHandlePointerDown}
          onPointerMove={onHandlePointerMove}
          onPointerUp={onHandlePointerUp}
          onPointerCancel={onHandlePointerUp}
          role="separator"
          aria-orientation="horizontal"
          aria-label="Resize editor panel"
        >
          <div className="w-10 h-1 bg-edge-strong rounded-full opacity-60" />
        </div>
        <div className="flex-1 min-h-0">
          {sidebar}
        </div>
      </div>
    </div>
  );
}

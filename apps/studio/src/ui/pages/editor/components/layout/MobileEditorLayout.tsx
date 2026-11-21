import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react';
import { BottomSheetResizeController } from '@presentation/editor/controllers/BottomSheetResizeController';
import { useObservedHeightPx } from '@ui/_shared/hooks/useObservedHeightPx';
import { useSheetContentResize } from '@ui/pages/editor/hooks/useSheetContentResize';

interface MobileEditorLayoutProps {
  videoBox: ReactNode;
  playbackControls: ReactNode;
  sidebar: ReactNode;
  videoAspectRatio: number | null;
  /** A panel shown in the sheet in front of the sidebar while `leadingPanelOpen`. It stays mounted while hidden. */
  leadingPanel?: ReactNode;
  leadingPanelOpen: boolean;
}

interface RectSize {
  readonly widthPx: number;
  readonly heightPx: number;
}

const VIDEO_ZONE_GAP_PX = 8;
// Room between the playback bar and the sheet, so the two do not touch: the region's bottom padding (`pb-2`).
const VIDEO_ZONE_BOTTOM_PX = 8;

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
 * sheet that hosts the sidebar. A vertical drag resizes the split from the
 * video region (anywhere over the video or the playback bar) and from the
 * sheet itself where its content has no use for the drag: wherever nothing
 * scrolls (a header, the tab bar), and, pulling down, over a list already
 * scrolled to its top. Taps, horizontal scrubs, fields and scrolling keep
 * working.
 *
 * A leading panel, when given and open, stands in front of the sidebar
 * inside the sheet.
 */
export function MobileEditorLayout({
  videoBox,
  playbackControls,
  sidebar,
  videoAspectRatio,
  leadingPanel,
  leadingPanelOpen,
}: MobileEditorLayoutProps) {
  const showsLeadingPanel = leadingPanel !== undefined && leadingPanelOpen;
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
    const videoZoneHeightPx = videoMaxHeightPx + playbackControlsHeightPx + VIDEO_ZONE_GAP_PX + VIDEO_ZONE_BOTTOM_PX;
    const floor = 1 - videoZoneHeightPx / containerRect.heightPx;
    controller.setMinPctFloor(floor);
  }, [controller, videoAspectRatio, containerRect.widthPx, containerRect.heightPx, playbackControlsHeightPx]);

  const measuredContainerHeight = useCallback(
    (): number => containerRef.current?.getBoundingClientRect().height ?? 0,
    [],
  );
  const sheetRef = useRef<HTMLDivElement>(null);
  useSheetContentResize(sheetRef, controller, measuredContainerHeight);

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
        className="absolute inset-x-0 top-0 flex flex-col items-center gap-2 px-1 pb-2 touch-none [container-type:size]"
        data-tscaps-deselect-zone
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
        ref={sheetRef}
        className="absolute inset-x-0 bottom-0 flex flex-col bg-surface-1 border-t border-edge-medium rounded-t-xl shadow-md select-none"
        style={{
          height: `${pct * 100}%`,
          transition: isDragging ? 'none' : 'height 200ms ease-out',
        }}
        data-tscaps-sidebar
      >
        {/* The sidebar is hidden rather than unmounted behind the leading
            panel, so closing the panel lands on the mode it left. */}
        <div className={`flex-1 min-h-0 ${showsLeadingPanel ? 'hidden' : ''}`}>
          {sidebar}
        </div>
        {leadingPanel !== undefined && (
          <div className={`flex-1 min-h-0 select-text ${showsLeadingPanel ? 'animate-fade-in' : 'hidden'}`}>
            {leadingPanel}
          </div>
        )}
      </div>
    </div>
  );
}

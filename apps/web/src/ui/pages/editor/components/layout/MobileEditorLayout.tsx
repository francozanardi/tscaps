import { useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react';

interface MobileEditorLayoutProps {
  videoBox: ReactNode;
  playbackControls: ReactNode;
  sidebar: ReactNode;
}

// Bottom-sheet snap fractions, relative to the available height between the
// toolbar and the viewport bottom. `MIN`/`MAX` clamp manual drags. The set
// must include both endpoints — the snap-on-release logic looks them up by
// proximity, so dropping the endpoints would create dead drag zones.
const SHEET_SNAP_POINTS: readonly number[] = [0.30, 0.60, 0.90];
const SHEET_MIN = 0.30;
const SHEET_MAX = 0.90;

/**
 * Mobile editor layout. Video region fills the area above a pull-up bottom
 * sheet that hosts the sidebar; the user drags the handle (or any one-finger
 * pointer gesture on it) to redistribute space, snapping to the points on
 * release. Default rests at `SHEET_MIN` so the video gets the most room
 * unless the user actively expands the editor.
 */
export function MobileEditorLayout({ videoBox, playbackControls, sidebar }: MobileEditorLayoutProps) {
  const [sheetPct, setSheetPct] = useState<number>(SHEET_MIN);
  const [isDragging, setIsDragging] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const dragStateRef = useRef<{ startY: number; startPct: number } | null>(null);

  const onPointerDown = (e: ReactPointerEvent<HTMLElement>) => {
    if (!containerRef.current) return;
    dragStateRef.current = { startY: e.clientY, startPct: sheetPct };
    setIsDragging(true);
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e: ReactPointerEvent<HTMLElement>) => {
    if (!dragStateRef.current || !containerRef.current) return;
    const containerH = containerRef.current.getBoundingClientRect().height;
    if (containerH === 0) return;
    const dy = e.clientY - dragStateRef.current.startY;
    // Pulling up (negative dy) increases sheet pct.
    const next = dragStateRef.current.startPct - dy / containerH;
    setSheetPct(Math.max(SHEET_MIN, Math.min(SHEET_MAX, next)));
  };

  const onPointerUp = (e: ReactPointerEvent<HTMLElement>) => {
    if (!dragStateRef.current) return;
    setIsDragging(false);
    dragStateRef.current = null;
    e.currentTarget.releasePointerCapture(e.pointerId);
    setSheetPct((current) => {
      let best = SHEET_MIN;
      for (const candidate of SHEET_SNAP_POINTS) {
        if (Math.abs(candidate - current) < Math.abs(best - current)) best = candidate;
      }
      return best;
    });
  };

  return (
    <div ref={containerRef} className="relative w-full flex-1 min-h-0">
      {/* Video region: occupies whatever the sheet leaves above. */}
      <div
        className="absolute inset-x-0 top-0 flex flex-col items-center gap-2 px-1"
        style={{ bottom: `${sheetPct * 100}%` }}
      >
        <div className="flex-1 min-h-0 w-full flex items-center justify-center">
          {videoBox}
        </div>
        {playbackControls}
      </div>
      {/* Bottom sheet: `select-none` keeps the OS from offering text-selection
          handles while the user drags. */}
      <div
        className="absolute inset-x-0 bottom-0 flex flex-col bg-surface-1 border-t border-edge-medium rounded-t-xl shadow-md select-none"
        style={{
          height: `${sheetPct * 100}%`,
          transition: isDragging ? 'none' : 'height 200ms ease-out',
        }}
      >
        <div
          className="flex items-center justify-center py-2 cursor-row-resize touch-none shrink-0"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
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

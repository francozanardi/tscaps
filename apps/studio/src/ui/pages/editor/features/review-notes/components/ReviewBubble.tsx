import { useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import type { ReviewPoint } from '@core/review-notes/domain/ReviewPoint';
import { useIsMobileViewport } from '@ui/_shared/hooks/useIsMobileViewport';
import { useVisualViewportBottom } from '@ui/pages/editor/features/review-notes/hooks/useVisualViewportBottom';
import { REVIEW_FLOATING } from '@ui/pages/editor/features/review-notes/review-notes-classes';

interface ReviewBubbleProps {
  /** Where the bubble hangs, in shares of the frame. */
  at: ReviewPoint;
  /** The frame's box on screen, measured again whenever it moves. */
  frame: DOMRect;
  label: string;
  children: ReactNode;
}

const GAP_PX = 12;
const EDGE_PX = 8;

/**
 * A note's bubble, hung from a point of the frame but drawn over the
 * whole page, so the frame's edges never cut it: it opens below and to
 * the right of the point, and turns to the other side where the window
 * has no room. On a phone's layout it is docked across the bottom of
 * what shows instead, above the on-screen keyboard while one is open,
 * since a bubble beside the point would end up under it. Presses inside
 * it stay inside it.
 */
export function ReviewBubble({ at, frame, label, children }: ReviewBubbleProps) {
  const ref = useRef<HTMLDivElement>(null);
  const docked = useIsMobileViewport();
  const visibleBottom = useVisualViewportBottom();
  const anchorX = frame.left + at.x * frame.width;
  const anchorY = frame.top + at.y * frame.height;
  const [position, setPosition] = useState<{ left: number; top: number } | null>(null);

  useLayoutEffect(() => {
    const bubble = ref.current;
    if (!bubble) return;
    const { offsetWidth: width, offsetHeight: height } = bubble;
    if (docked) {
      const top = Math.max(EDGE_PX, visibleBottom - EDGE_PX - height);
      setPosition((held) => (held !== null && held.top === top ? held : { left: EDGE_PX, top }));
      return;
    }
    const fitsRight = anchorX + GAP_PX + width <= window.innerWidth - EDGE_PX;
    const fitsBelow = anchorY + GAP_PX + height <= window.innerHeight - EDGE_PX;
    const left = fitsRight ? anchorX + GAP_PX : Math.max(EDGE_PX, anchorX - GAP_PX - width);
    const top = fitsBelow ? anchorY + GAP_PX : Math.max(EDGE_PX, anchorY - GAP_PX - height);
    setPosition((held) => (held !== null && held.left === left && held.top === top ? held : { left, top }));
  }, [anchorX, anchorY, children, docked, visibleBottom]);

  return createPortal(
    <div
      ref={ref}
      role="dialog"
      aria-label={label}
      className={`${REVIEW_FLOATING} fixed z-50 p-2 flex flex-col gap-2 ${docked ? 'left-2 right-2 mx-auto max-w-lg' : 'w-64'}`}
      // Measured before it is first painted, so it never shows in the wrong place. Unseen by opacity, not by
      // visibility: a field inside must take focus as it appears, and a hidden element cannot.
      style={position === null
        ? { left: 0, top: 0, opacity: 0 }
        : docked ? { top: position.top } : { left: position.left, top: position.top }}
      onPointerDown={(event) => event.stopPropagation()}
      onClick={(event) => event.stopPropagation()}
    >
      {children}
    </div>,
    document.body,
  );
}

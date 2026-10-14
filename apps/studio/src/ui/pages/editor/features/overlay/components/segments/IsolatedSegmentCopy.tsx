import { useEffect, useRef, type CSSProperties, type ReactNode } from 'react';
import { useOverlayManipulationController } from '@ui/pages/editor/features/overlay/contexts/OverlayManipulationContext';

interface IsolatedSegmentCopyProps {
  segmentId: string;
  anchorStyle: CSSProperties;
  wrapperClassName: string;
  wrapperStyle: CSSProperties;
  /** The copy of the segment's subtree, already told which elements it keeps. */
  children: ReactNode;
}

/**
 * One copy of a segment's subtree, laid out exactly over the original
 * and painted after it, so the elements it keeps paint on top.
 *
 * The elements it keeps are hidden in the original, and a hidden
 * element takes no pointer, so the copy is where they are clicked. Its
 * wrapper carries the segment id for that: a press resolves to the
 * segment by walking up to it, while the `.segment` inside stays
 * unmarked, so every lookup of the segment's own element still finds
 * the original. It also travels with the original during a drag, which
 * moves the original's wrapper directly rather than through a render.
 */
export function IsolatedSegmentCopy({ segmentId, anchorStyle, wrapperClassName, wrapperStyle, children }: IsolatedSegmentCopyProps) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const manipulationController = useOverlayManipulationController();
  useEffect(() => {
    const wrapper = wrapperRef.current;
    if (!wrapper) return;
    return manipulationController.bindSegmentCopy({ segmentId, wrapper });
  }, [manipulationController, segmentId]);

  return (
    <div className="subtitle-overlay-anchor" style={anchorStyle}>
      <div
        ref={wrapperRef}
        className={wrapperClassName}
        style={wrapperStyle}
        data-tscaps-segment-id={segmentId}
        aria-hidden
      >
        {children}
      </div>
    </div>
  );
}

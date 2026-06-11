import { memo, useLayoutEffect, useRef, type MouseEvent, type RefObject } from 'react';
import { RotateCw } from 'lucide-react';
import { useOverlayManipulationController } from '@ui/editor/components/overlay/OverlayManipulationContext';
import { useOverlayDragState } from '@ui/editor/components/overlay/useOverlayDragState';
import { measureWordRotatedBox } from '@ui/editor/components/overlay/wordRotatedBoxProbe';

interface WordRotateHandleProps {
  wordId: string;
  /** Positioned ancestor the layout is mounted in and measured against — the scaler. */
  containerRef: RefObject<HTMLElement>;
}

const WORD_ROTATE_FRAME_PADDING_PX = 3;
const WORD_ROTATE_HANDLE_OFFSET_PX = 6;

/**
 * Rotation icon mounted above the selected word. Rendered inside a
 * rotated frame so the handle stays at the top-center of the WORD's
 * rotated visual frame, not at the top-center of its axis-aligned
 * bounding rect.
 *
 * Mounted at the scaler level so it survives segments rendered empty
 * and stays outside any segment-level SVG filter that would distort
 * it. Re-measures the word's bbox on every drag-state transition.
 */
export const WordRotateHandle = memo(function WordRotateHandle({ wordId, containerRef }: WordRotateHandleProps) {
  const controller = useOverlayManipulationController();
  const dragState = useOverlayDragState();
  const frameRef = useRef<HTMLDivElement>(null);
  const handleRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const frame = frameRef.current;
    const container = containerRef.current;
    if (!frame || !container) return;
    const scope = container.closest<HTMLElement>('.subtitle-overlay-scaler') ?? container;
    const reposition = (): void => repositionFrame(frame, container, scope, wordId);
    reposition();
    const observer = new ResizeObserver(reposition);
    observer.observe(container);
    return () => observer.disconnect();
  }, [wordId, containerRef]);

  useLayoutEffect(() => {
    const frame = frameRef.current;
    const container = containerRef.current;
    if (!frame || !container) return;
    const scope = container.closest<HTMLElement>('.subtitle-overlay-scaler') ?? container;
    repositionFrame(frame, container, scope, wordId);
  }, [dragState, wordId, containerRef]);

  useLayoutEffect(() => {
    const handle = handleRef.current;
    if (!handle) return;
    return controller.bindWordRotateHandle({ wordId, handle });
  }, [controller, wordId]);

  if (dragState?.kind === 'segment-rotate') return null;
  const rotationLabel = dragState?.kind === 'word-rotate' && dragState.wordId === wordId
    ? `${Math.round(dragState.rotationDeg)}°`
    : null;
  const className = rotationLabel !== null
    ? 'subtitle-overlay-word-rotate-handle is-rotating'
    : 'subtitle-overlay-word-rotate-handle';
  return (
    <div ref={frameRef} className="subtitle-overlay-word-rotate-frame" aria-hidden>
      <div ref={handleRef} className={className} onClick={swallowClick}>
        {rotationLabel ?? <RotateCw size={12} />}
      </div>
    </div>
  );
});

function swallowClick(event: MouseEvent): void {
  event.stopPropagation();
}

function repositionFrame(
  frame: HTMLDivElement,
  container: HTMLElement,
  scope: HTMLElement,
  wordId: string,
): void {
  const measured = measureWordRotatedBox(scope, wordId);
  if (!measured) {
    frame.style.visibility = 'hidden';
    return;
  }
  const box = container.getBoundingClientRect();
  const width = measured.unrotatedWidth + WORD_ROTATE_FRAME_PADDING_PX * 2;
  const height = measured.unrotatedHeight + WORD_ROTATE_FRAME_PADDING_PX * 2;
  frame.style.visibility = 'visible';
  frame.style.left = `${measured.visualCenterX - width / 2 - box.left}px`;
  frame.style.top = `${measured.visualCenterY - height / 2 - box.top}px`;
  frame.style.width = `${width}px`;
  frame.style.height = `${height}px`;
  frame.style.transform = measured.transform;
  frame.style.transformOrigin = 'center';
  frame.style.setProperty('--tscaps-rotate-handle-offset', `${WORD_ROTATE_HANDLE_OFFSET_PX}px`);
}

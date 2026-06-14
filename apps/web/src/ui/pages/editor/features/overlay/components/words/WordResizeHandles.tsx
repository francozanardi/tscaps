import { memo, useLayoutEffect, useRef, type MouseEvent, type RefObject } from 'react';
import type { ResizeCorner } from '@presentation/editor/services/ResizeGeometryResolver';
import { useOverlayManipulationController } from '@ui/pages/editor/features/overlay/contexts/OverlayManipulationContext';
import { useOverlayDragState } from '@ui/pages/editor/features/overlay/hooks/useOverlayDragState';
import { measureWordRotatedBox } from '@ui/pages/editor/features/overlay/wordRotatedBoxProbe';

interface WordResizeHandlesProps {
  wordId: string;
  /** Positioned ancestor the handles are mounted in and measured against — the scaler. */
  containerRef: RefObject<HTMLElement>;
}

const CORNERS: readonly ResizeCorner[] = ['tl', 'tr', 'bl', 'br'];

const CORNER_CLASS_BY_KIND: Record<ResizeCorner, string> = {
  tl: 'subtitle-overlay-word-handle-tl',
  tr: 'subtitle-overlay-word-handle-tr',
  bl: 'subtitle-overlay-word-handle-bl',
  br: 'subtitle-overlay-word-handle-br',
};

// Inflate (in px on each side) added to the word's bbox so the handles
// frame the word's selection ring (which uses the same padding in JS)
// instead of kissing the glyphs.
const WORD_HANDLES_BOX_PADDING_PX = 3;

/**
 * Four corner resize handles for the currently-selected word, mounted
 * at the scaler level so they survive segments rendered empty and
 * stay outside any segment-level SVG filter that would distort them.
 * Re-measures the word's bbox on every drag-state transition so the
 * handles track the word's growing or shrinking glyph box live.
 */
export const WordResizeHandles = memo(function WordResizeHandles({ wordId, containerRef }: WordResizeHandlesProps) {
  const layoutRef = useRef<HTMLDivElement>(null);
  const dragState = useOverlayDragState();

  useLayoutEffect(() => {
    const layout = layoutRef.current;
    const container = containerRef.current;
    if (!layout || !container) return;
    const scope = container.closest<HTMLElement>('.subtitle-overlay-scaler') ?? container;
    const reposition = (): void => repositionLayout(layout, container, scope, wordId);
    reposition();
    const observer = new ResizeObserver(reposition);
    observer.observe(container);
    return () => observer.disconnect();
  }, [wordId, containerRef]);

  useLayoutEffect(() => {
    const layout = layoutRef.current;
    const container = containerRef.current;
    if (!layout || !container) return;
    const scope = container.closest<HTMLElement>('.subtitle-overlay-scaler') ?? container;
    repositionLayout(layout, container, scope, wordId);
  }, [dragState, wordId, containerRef]);

  if (dragState?.kind === 'segment-rotate') return null;
  return (
    <div ref={layoutRef} className="subtitle-overlay-word-handles" aria-hidden>
      {CORNERS.map((corner) => (
        <CornerHandle key={corner} wordId={wordId} corner={corner} />
      ))}
    </div>
  );
});

interface CornerHandleProps {
  wordId: string;
  corner: ResizeCorner;
}

function CornerHandle({ wordId, corner }: CornerHandleProps) {
  const controller = useOverlayManipulationController();
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const handle = ref.current;
    if (!handle) return;
    return controller.bindWordResizeHandle({ wordId, corner, handle });
  }, [controller, wordId, corner]);
  const className = `subtitle-overlay-word-handle ${CORNER_CLASS_BY_KIND[corner]}`;
  return <div ref={ref} className={className} onClick={swallowClick} aria-hidden />;
}

function swallowClick(event: MouseEvent): void {
  event.stopPropagation();
}

function repositionLayout(
  layout: HTMLDivElement,
  container: HTMLElement,
  scope: HTMLElement,
  wordId: string,
): void {
  const measured = measureWordRotatedBox(scope, wordId);
  if (!measured) {
    layout.style.visibility = 'hidden';
    return;
  }
  const box = container.getBoundingClientRect();
  const width = measured.unrotatedWidth + WORD_HANDLES_BOX_PADDING_PX * 2;
  const height = measured.unrotatedHeight + WORD_HANDLES_BOX_PADDING_PX * 2;
  layout.style.visibility = 'visible';
  layout.style.left = `${measured.visualCenterX - width / 2 - box.left}px`;
  layout.style.top = `${measured.visualCenterY - height / 2 - box.top}px`;
  layout.style.width = `${width}px`;
  layout.style.height = `${height}px`;
  layout.style.transform = measured.transform;
  layout.style.transformOrigin = 'center';
}

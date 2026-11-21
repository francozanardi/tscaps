import { memo, useLayoutEffect, useRef } from 'react';
import type { FootageGrade } from '@tscaps/engine';
import { useEngine } from '@ui/_shared/contexts/modules/EngineContext';

interface GradedPosterProps {
  /** The picture, as a URL an image loads; null shows an empty frame. */
  poster: string | null;
  grade: FootageGrade;
  widthPx: number;
  heightPx: number;
}

const CANVAS_CLASS = 'block rounded-xs bg-surface-3';

/**
 * A picture drawn small in a grade, through the grader the preview and
 * the export grade with, so what it shows is what they draw. The
 * picture covers the frame, centred.
 */
export const GradedPoster = memo(function GradedPoster({ poster, grade, widthPx, heightPx }: GradedPosterProps) {
  const { footageGrader } = useEngine();
  const canvas = useRef<HTMLCanvasElement>(null);

  useLayoutEffect(() => {
    const target = canvas.current;
    const context = target?.getContext('2d') ?? null;
    if (target === null || context === null) return;
    const width = target.width;
    const height = target.height;
    context.clearRect(0, 0, width, height);
    if (poster === null) return;
    const image = new Image();
    let current = true;
    image.onload = () => {
      if (!current) return;
      const scale = Math.max(width / image.naturalWidth, height / image.naturalHeight);
      const drawnWidth = image.naturalWidth * scale;
      const drawnHeight = image.naturalHeight * scale;
      context.drawImage(image, (width - drawnWidth) / 2, (height - drawnHeight) / 2, drawnWidth, drawnHeight);
      footageGrader.grade(context, width, height, grade);
    };
    image.src = poster;
    return () => { current = false; };
  }, [poster, grade, footageGrader, widthPx, heightPx]);

  return <canvas ref={canvas} width={widthPx * 2} height={heightPx * 2} style={{ width: widthPx, height: heightPx }} className={CANVAS_CLASS} aria-hidden />;
});

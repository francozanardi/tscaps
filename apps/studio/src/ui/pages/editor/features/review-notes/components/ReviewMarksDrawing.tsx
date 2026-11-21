import { memo } from 'react';
import type { ReviewMark } from '@core/review-notes/domain/ReviewMark';
import { ReviewMarkGeometry } from '@presentation/review-notes/services/ReviewMarkGeometry';

const geometry = new ReviewMarkGeometry();

interface ReviewMarksDrawingProps {
  /** Every mark to draw, in the order drawn. */
  marks: ReadonlyArray<ReviewMark>;
  /** The output frame's width over its height. */
  aspect: number;
}

/**
 * Draws review marks over the whole frame in the accent, over a dark halo
 * so they read on any picture; the line keeps its width however large the
 * frame is shown. Takes no pointer.
 */
export const ReviewMarksDrawing = memo(function ReviewMarksDrawing({ marks, aspect }: ReviewMarksDrawingProps) {
  if (marks.length === 0) return null;
  const paths = marks.map((mark) => geometry.pathOf(mark, aspect));
  return (
    <svg
      className="absolute inset-0 w-full h-full pointer-events-none overflow-visible"
      viewBox={`0 0 ${100 * aspect} 100`}
      preserveAspectRatio="none"
      aria-hidden
    >
      <g fill="none" strokeLinecap="round" strokeLinejoin="round">
        {paths.map((path, index) => (
          <path key={`halo-${index}`} d={path} stroke="rgb(0 0 0 / 0.55)" strokeWidth={6} vectorEffect="non-scaling-stroke" />
        ))}
        {paths.map((path, index) => (
          <path key={`ink-${index}`} d={path} stroke="rgb(var(--color-accent))" strokeWidth={3} vectorEffect="non-scaling-stroke" />
        ))}
      </g>
    </svg>
  );
});

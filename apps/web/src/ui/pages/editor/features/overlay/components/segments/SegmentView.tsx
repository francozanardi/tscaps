import { memo, type CSSProperties, type ReactNode } from 'react';
import type { Segment, WordSplitter } from '@tscaps/engine';
import type { WordStyleOverrideRegistry } from '@core/captions/domain/WordStyleOverrideRegistry';
import { LineView } from '@ui/pages/editor/features/overlay/components/LineView';
import { useBoundSegment } from '@ui/pages/editor/features/overlay/hooks/useOverlayBinding';

interface SegmentViewProps {
  segment: Segment;
  letterSplitter: WordSplitter | null;
  wordStyleOverrides: WordStyleOverrideRegistry;
  /** Optional element rendered as the segment's first child — clipped by its `overflow` / `border-radius`. */
  layer?: ReactNode;
}

// React must not set `className` on the segment element — the overlay
// controller writes the time-driven class list there and would be
// clobbered on every React update if React owned the prop.
const PAUSED_ANIMATION_STYLE: CSSProperties = { animationPlayState: 'paused', animationFillMode: 'both' };

export const SegmentView = memo(function SegmentView({ segment, letterSplitter, wordStyleOverrides, layer }: SegmentViewProps) {
  const ref = useBoundSegment(segment);
  return (
    <div ref={ref} style={PAUSED_ANIMATION_STYLE}>
      {layer}
      {[...segment.lines].map((line, idx) => (
        <LineView
          key={idx}
          line={line}
          segmentId={segment.id}
          letterSplitter={letterSplitter}
          wordStyleOverrides={wordStyleOverrides}
        />
      ))}
    </div>
  );
});

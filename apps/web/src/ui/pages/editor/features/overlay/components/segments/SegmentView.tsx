import { memo, useMemo, type CSSProperties, type ReactNode } from 'react';
import type { DecorationPlacementSide, Decoration, Segment, Word, WordSplitter } from '@tscaps/engine';
import type { WordStyleOverrideRegistry } from '@core/captions/domain/WordStyleOverrideRegistry';
import { LineView } from '@ui/pages/editor/features/overlay/components/LineView';
import { WordDecorationSpan } from '@ui/pages/editor/features/overlay/components/words/WordDecorationSpan';
import { useBoundSegment } from '@ui/pages/editor/features/overlay/hooks/useOverlayBinding';

interface SegmentViewProps {
  segment: Segment;
  letterSplitter: WordSplitter | null;
  wordStyleOverrides: WordStyleOverrideRegistry;
  /** Decoration ids whose inline `<span>` should be omitted — either because the glyph paints out of flow at its own anchor, or because the emoji effect is disabled on the host sheet. */
  inlineSuppressedDecorationIds: ReadonlySet<string>;
  /** Decorations the sheet promotes out of line flow, keyed by decoration id. Absent ids stay inline. */
  decorationPlacements: ReadonlyMap<string, DecorationPlacementSide>;
  /** Optional element rendered as the segment's first child — clipped by its `overflow` / `border-radius`. */
  layer?: ReactNode;
}

interface PlacedDecoration {
  decoration: Decoration;
  word: Word;
}

// React must not set `className` on the segment element — the overlay
// controller writes the time-driven class list there and would be
// clobbered on every React update if React owned the prop.
const PAUSED_ANIMATION_STYLE: CSSProperties = { animationPlayState: 'paused', animationFillMode: 'both' };

export const SegmentView = memo(function SegmentView({
  segment,
  letterSplitter,
  wordStyleOverrides,
  inlineSuppressedDecorationIds,
  decorationPlacements,
  layer,
}: SegmentViewProps) {
  const ref = useBoundSegment(segment);
  const promotedAbove = useMemo(
    () => collectPromotedDecorations(segment, decorationPlacements, 'above'),
    [segment, decorationPlacements],
  );
  const promotedBelow = useMemo(
    () => collectPromotedDecorations(segment, decorationPlacements, 'below'),
    [segment, decorationPlacements],
  );
  return (
    <div ref={ref} style={PAUSED_ANIMATION_STYLE}>
      {layer}
      <PromotedDecorationsContainer
        side="above"
        segmentId={segment.id}
        decorations={promotedAbove}
        wordStyleOverrides={wordStyleOverrides}
      />
      {[...segment.lines].map((line, idx) => (
        <LineView
          key={idx}
          line={line}
          segmentId={segment.id}
          letterSplitter={letterSplitter}
          wordStyleOverrides={wordStyleOverrides}
          inlineSuppressedDecorationIds={inlineSuppressedDecorationIds}
        />
      ))}
      <PromotedDecorationsContainer
        side="below"
        segmentId={segment.id}
        decorations={promotedBelow}
        wordStyleOverrides={wordStyleOverrides}
      />
    </div>
  );
});

interface PromotedDecorationsContainerProps {
  side: DecorationPlacementSide;
  segmentId: string;
  decorations: ReadonlyArray<PlacedDecoration>;
  wordStyleOverrides: WordStyleOverrideRegistry;
}

function PromotedDecorationsContainer({ side, segmentId, decorations, wordStyleOverrides }: PromotedDecorationsContainerProps) {
  if (decorations.length === 0) return null;
  const className = side === 'above' ? 'segment-decorations-above' : 'segment-decorations-below';
  return (
    <div className={className}>
      {decorations.map(({ decoration }) => (
        <WordDecorationSpan
          key={decoration.id}
          decoration={decoration}
          segmentId={segmentId}
          inlineStyle={wordStyleOverrides.buildInlineStyles(decoration.id)}
        />
      ))}
    </div>
  );
}

function collectPromotedDecorations(
  segment: Segment,
  placements: ReadonlyMap<string, DecorationPlacementSide>,
  side: DecorationPlacementSide,
): PlacedDecoration[] {
  if (placements.size === 0) return [];
  const out: PlacedDecoration[] = [];
  for (const line of segment.lines) {
    for (const word of line.words) {
      if (!word.decoration) continue;
      if (placements.get(word.decoration.id) !== side) continue;
      out.push({ decoration: word.decoration, word });
    }
  }
  return out;
}

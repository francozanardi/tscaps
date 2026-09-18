import { memo, useCallback, useMemo, useRef, type CSSProperties, type ReactNode, type Ref } from 'react';
import type { DecorationPlacementSide, Decoration, Segment, TextDirection, Word, WordFragmenter, WordSplitter } from '@tscaps/engine';
import { LineView } from '@ui/pages/editor/features/overlay/components/LineView';
import { WordDecorationSpan } from '@ui/pages/editor/features/overlay/components/words/WordDecorationSpan';
import { useBoundSegment } from '@ui/pages/editor/features/overlay/hooks/useOverlayBinding';
import { useMeasuredWidth } from '@ui/pages/editor/features/overlay/hooks/useMeasuredWidth';
import { useEngine } from '@ui/_shared/contexts/modules/EngineContext';
import { CAPTION_ELEMENT_ID_ATTRIBUTE } from '@presentation/editor/services/CaptionElementAttribute';

interface SegmentViewProps {
  segment: Segment;
  /** Zero-based position of `segment` inside its owning section, published as `--segment-index`. */
  indexInSection: number;
  letterSplitter: WordSplitter | null;
  wordFragmenter: WordFragmenter;
  /** Paragraph direction every line of the segment is resolved against. */
  textDirection: TextDirection;
  /** Per-word `font-family` values keyed by word id. Words that inherit the cascade are absent. */
  wordFontFamilies: ReadonlyMap<string, string>;
  /** Font variables the segment declares over its own stored style. Empty when it was given no font of its own. */
  segmentFontVars?: CSSProperties;
  /** Font variables each line declares over its own stored style, keyed by line id. Lines given no font of their own are absent. */
  lineFontVars?: ReadonlyMap<string, CSSProperties>;
  /** Decoration ids whose inline `<span>` should be omitted — either because the glyph paints out of flow at its own anchor, or because the emoji effect is disabled on the host sheet. */
  inlineSuppressedDecorationIds: ReadonlySet<string>;
  /** Words painted out of flow at their own anchor, so the line leaves a gap rather than a duplicate. */
  placedWordIds: ReadonlySet<string>;
  /** Decorations the sheet promotes out of line flow, keyed by decoration id. Absent ids stay inline. */
  decorationPlacements: ReadonlyMap<string, DecorationPlacementSide>;
  /** Optional element rendered as the segment's first child — clipped by its `overflow` / `border-radius`. */
  layer?: ReactNode;
  /** When set, the segment element is interactive: it carries `data-tscaps-segment-id` and the given ref points at it. Measurement code (hitzone, chrome, drop zones) reads its bounds; the element itself stays pointer-transparent. Omit for passive previews. */
  interactionRef?: Ref<HTMLDivElement>;
  /** Time-independent classes appended to the segment element's class list (memoized by the caller). */
  extraSegmentClasses?: ReadonlyArray<string>;
}

interface PlacedDecoration {
  decoration: Decoration;
  word: Word;
}

const EMPTY_EXTRA_CLASSES: ReadonlyArray<string> = [];

function forwardRefTo<T>(target: Ref<T> | undefined, element: T | null): void {
  if (!target) return;
  if (typeof target === 'function') target(element);
  else (target as { current: T | null }).current = element;
}

export const SegmentView = memo(function SegmentView({
  segment,
  indexInSection,
  letterSplitter,
  wordFragmenter,
  textDirection,
  wordFontFamilies,
  segmentFontVars,
  lineFontVars,
  inlineSuppressedDecorationIds,
  placedWordIds,
  decorationPlacements,
  layer,
  interactionRef,
  extraSegmentClasses,
}: SegmentViewProps) {
  const classes = extraSegmentClasses ?? EMPTY_EXTRA_CLASSES;
  const segmentRef = useRef<HTMLDivElement | null>(null);
  useBoundSegment(segmentRef, segment, indexInSection, classes);
  const { constants } = useEngine();
  useMeasuredWidth(segmentRef, constants.SEGMENT_WIDTH_EM_VARIABLE);
  const attachRef = useCallback(
    (element: HTMLDivElement | null) => {
      segmentRef.current = element;
      forwardRefTo(interactionRef, element);
    },
    [interactionRef],
  );
  const promotedAbove = useMemo(
    () => collectPromotedDecorations(segment, decorationPlacements, 'above'),
    [segment, decorationPlacements],
  );
  const promotedBelow = useMemo(
    () => collectPromotedDecorations(segment, decorationPlacements, 'below'),
    [segment, decorationPlacements],
  );
  return (
    // React must not set `className` here — the overlay controller writes
    // the time-driven class list on this element and would be clobbered on
    // every React update if React owned the prop.
    <div
      ref={attachRef}
      // On the segment element rather than on an ancestor: the segment's
      // own stored style declares the same variable here, and a value
      // declared on the element wins over one inherited into it.
      style={segmentFontVars}
      data-tscaps-segment-id={interactionRef ? segment.id : undefined}
      {...{ [CAPTION_ELEMENT_ID_ATTRIBUTE]: segment.id }}
    >
      {layer}
      <PromotedDecorationsContainer
        side="above"
        segment={segment}
        decorations={promotedAbove}
      />
      {[...segment.lines].map((line, idx) => (
        <LineView
          key={idx}
          line={line}
          segment={segment}
          letterSplitter={letterSplitter}
          wordFragmenter={wordFragmenter}
          textDirection={textDirection}
          wordFontFamilies={wordFontFamilies}
          fontVars={lineFontVars?.get(line.id)}
          placedWordIds={placedWordIds}
          inlineSuppressedDecorationIds={inlineSuppressedDecorationIds}
        />
      ))}
      <PromotedDecorationsContainer
        side="below"
        segment={segment}
        decorations={promotedBelow}
      />
    </div>
  );
});

interface PromotedDecorationsContainerProps {
  side: DecorationPlacementSide;
  segment: Segment;
  decorations: ReadonlyArray<PlacedDecoration>;
}

function PromotedDecorationsContainer({ side, segment, decorations }: PromotedDecorationsContainerProps) {
  if (decorations.length === 0) return null;
  const className = side === 'above' ? 'segment-decorations-above' : 'segment-decorations-below';
  return (
    <div className={className}>
      {decorations.map(({ decoration, word }) => (
        <WordDecorationSpan
          key={decoration.id}
          decoration={decoration}
          segment={segment}
          word={word}
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

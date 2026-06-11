import { memo, type CSSProperties } from 'react';
import type { Line, WordSplitter } from '@tscaps/engine';
import type { WordStyleOverrideRegistry } from '@core/editor/domain/WordStyleOverrideRegistry';
import { WordView } from '@ui/editor/components/overlay/WordView';
import { useBoundLine } from '@ui/editor/components/overlay/useOverlayBinding';
import { useDraggedWordId } from '@ui/editor/components/overlay/useDraggedWordId';

interface LineViewProps {
  line: Line;
  segmentId: string;
  letterSplitter: WordSplitter | null;
  wordStyleOverrides: WordStyleOverrideRegistry;
}

// React must not set `className` on the line element — the overlay
// controller writes the time-driven class list there and would be
// clobbered on every React update if React owned the prop.
const PAUSED_ANIMATION_STYLE: CSSProperties = { animationPlayState: 'paused', animationFillMode: 'both' };

export const LineView = memo(function LineView({ line, segmentId, letterSplitter, wordStyleOverrides }: LineViewProps) {
  // A word being actively dragged is rendered in a positioned-word
  // sibling for the duration of the gesture so it lives outside the
  // segment's filter / clip region. Skipping it here lets the line
  // reflow around the gap exactly like an already-detached word.
  const draggedWordId = useDraggedWordId();
  const visibleWords = [...line.words].filter(
    (word) => !wordStyleOverrides.hasAlignmentOverride(word.id) && word.id !== draggedWordId,
  );
  // When the line has no visible words, render nothing — emitting an
  // empty `<div class="line">` would still paint the template's
  // line-level decorations (bubble background, ::after tail, etc.) as
  // a ghost shape with no content.
  const ref = useBoundLine(line, visibleWords.length > 0);
  if (visibleWords.length === 0) return null;
  return (
    <div ref={ref} style={PAUSED_ANIMATION_STYLE}>
      {visibleWords.map((word) => (
        <WordView
          key={word.id}
          word={word}
          segmentId={segmentId}
          letterSplitter={letterSplitter}
          inlineStyle={wordStyleOverrides.buildInlineStyles(word.id)}
        />
      ))}
    </div>
  );
});
